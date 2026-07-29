import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService, AudioScriptSegment } from '../gemini/gemini.service';
import { OpenaiService, OpenAiVoice } from '../openai/openai.service';
import { StorageService } from '../storage/storage.service';
import { UsageService } from '../usage/usage.service';
import { SessionsService } from '../sessions/sessions.service';
import { AiRouterService } from '../ai-router/ai-router.service';
import { CreateAudioSessionDto } from './dto/create-audio-session.dto';
import { StartAudioSessionDto } from './dto/start-audio-session.dto';

interface ClipRef {
  clipId: string;
  order: number;
  type: AudioScriptSegment['type'];
  url: string;
  durationSec: number;
  pauseAfterMs: number;
  cardId?: string;
}

const DEFAULT_VOICE: OpenAiVoice = 'alloy';

@Injectable()
export class AudioSessionsService {
  private readonly logger = new Logger(AudioSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly openai: OpenaiService,
    private readonly storage: StorageService,
    private readonly usage: UsageService,
    private readonly sessions: SessionsService,
    // Ledger-only integration, same as LessonsService: recorded for cost
    // visibility, not yet budget-gated through AiRouter. The clip cache
    // below (AudioClip.textHash) already does the job AiRouter's generalized
    // cache does elsewhere — it's the pattern that cache was modeled on, so
    // it's left as-is rather than rerouted.
    private readonly aiRouter: AiRouterService,
  ) {}

  async createSession(userId: string, dto: CreateAudioSessionDto) {
    const limit = await this.usage.checkUsageLimit(userId, 'audio_sessions');
    if (!limit.allowed) {
      throw new ForbiddenException({
        code: 'USAGE_LIMIT_EXCEEDED',
        used: limit.used,
        limit: limit.limit,
      });
    }

    const set = await this.prisma.flashcardSet.findFirst({
      where: { id: dto.flashcard_set_id, userId },
      include: { flashcards: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!set) {
      throw new NotFoundException('Flashcard set not found');
    }
    if (set.flashcards.length === 0) {
      throw new BadRequestException('Flashcard set is empty');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    const voice = (dto.voice as OpenAiVoice | undefined) ?? DEFAULT_VOICE;

    const audioSession = await this.prisma.audioStudySession.create({
      data: {
        userId,
        flashcardSetId: set.id,
        language: set.language,
        plannedDurationMinutes: dto.duration_minutes,
        status: 'generating',
        clips: [],
      },
    });

    await this.usage.incrementUsage(userId, 'audio_sessions');

    // Kick off async build; do not await
    this.buildSession(audioSession.id, {
      userId,
      flashcards: set.flashcards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        explain: c.explain,
      })),
      durationMinutes: dto.duration_minutes,
      language: set.language,
      userName: profile?.username,
      voice,
    }).catch((err) => {
      this.logger.error(`buildSession failed for ${audioSession.id}: ${err?.message ?? err}`);
      this.prisma.audioStudySession
        .update({
          where: { id: audioSession.id },
          data: { status: 'failed', errorMessage: err?.message ?? 'unknown error' },
        })
        .catch(() => undefined);
    });

    return { id: audioSession.id, status: audioSession.status };
  }

  async getSession(userId: string, id: string) {
    const session = await this.prisma.audioStudySession.findFirst({
      where: { id, userId },
    });
    if (!session) throw new NotFoundException('Audio session not found');
    return session;
  }

  async startSession(
    userId: string,
    id: string,
    dto: StartAudioSessionDto,
  ): Promise<{ studySessionId: string }> {
    const audio = await this.prisma.audioStudySession.findFirst({
      where: { id, userId },
    });
    if (!audio) throw new NotFoundException('Audio session not found');
    if (audio.status !== 'ready') {
      throw new BadRequestException(`Audio session not ready (status=${audio.status})`);
    }
    if (audio.studySessionId) {
      return { studySessionId: audio.studySessionId };
    }

    const workDuration = Math.max(
      5,
      Math.min(120, audio.plannedDurationMinutes),
    );

    const studySession = await this.sessions.startSession(userId, {
      subject_id: dto.subject_id,
      league_id: dto.league_id,
      timer_mode: 'audio',
      work_duration: workDuration,
      break_duration: 5,
      proof_mode: false,
    });

    const studySessionId = studySession.id;
    if (!studySessionId) {
      throw new BadRequestException('Failed to create study session');
    }

    await this.prisma.audioStudySession.update({
      where: { id: audio.id },
      data: { studySessionId },
    });

    return { studySessionId };
  }

  private async buildSession(
    audioSessionId: string,
    params: {
      userId: string;
      flashcards: { id: string; front: string; back: string; explain: string | null }[];
      durationMinutes: number;
      language: string;
      userName?: string;
      voice: OpenAiVoice;
    },
  ) {
    const { result: segments, inputTokens, outputTokens } = await this.gemini.planAudioScriptWithUsage(
      params.flashcards,
      params.durationMinutes,
      params.language,
      params.userName,
    );
    const scriptModel = this.aiRouter.modelFor('audio_script');
    await this.aiRouter.record({
      userId: params.userId,
      task: 'audio_script',
      provider: scriptModel.provider,
      model: scriptModel.model,
      inputUnits: inputTokens,
      outputUnits: outputTokens,
    });

    const clips: ClipRef[] = [];
    let totalDurationSec = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const text = seg.text?.trim();
      if (!text) continue;

      const voice = params.voice;
      const hash = this.hashText(text, voice, params.language);

      let clip = await this.prisma.audioClip.findUnique({
        where: { textHash: hash },
      });

      if (!clip) {
        const buffer = await this.openai.synthesize(text, voice, params.language);
        const path = `audio-clips/${hash}.mp3`;
        const url = await this.storage.uploadPublic(path, buffer, 'audio/mpeg');
        const estimatedDurationSec = Math.max(1, Math.round((text.length / 15)));
        clip = await this.prisma.audioClip.create({
          data: {
            textHash: hash,
            text,
            voice,
            language: params.language,
            url,
            durationSec: estimatedDurationSec,
          },
        });

        const ttsModel = this.aiRouter.modelFor('tts');
        // tts-1 is billed per character, per MODEL_PRICING's 'perChar' contract.
        await this.aiRouter.record({
          userId: params.userId,
          task: 'tts',
          provider: ttsModel.provider,
          model: ttsModel.model,
          inputUnits: text.length,
        });
      } else {
        // AudioClip.textHash already deduped this — the original pattern
        // AiRouter's generalized cache is modeled on. Record the hit so it
        // shows up in cache hit-rate the same way AiRouter's own cache does.
        const ttsModel = this.aiRouter.modelFor('tts');
        await this.aiRouter.record({
          userId: params.userId,
          task: 'tts',
          provider: ttsModel.provider,
          model: ttsModel.model,
          inputUnits: 0,
          cacheHit: true,
        });
      }

      totalDurationSec += clip.durationSec + seg.pauseAfterMs / 1000;

      clips.push({
        clipId: clip.id,
        order: clips.length,
        type: seg.type,
        url: clip.url,
        durationSec: clip.durationSec,
        pauseAfterMs: seg.pauseAfterMs,
        cardId: seg.cardId,
      });
    }

    await this.prisma.audioStudySession.update({
      where: { id: audioSessionId },
      data: {
        status: 'ready',
        clips: clips as unknown as object,
        totalDurationSec,
        readyAt: new Date(),
      },
    });

    this.logger.log(
      `Audio session ${audioSessionId} ready: ${clips.length} clips, ${totalDurationSec.toFixed(1)}s`,
    );
  }

  private hashText(text: string, voice: string, language: string): string {
    return createHash('sha256')
      .update(`${voice}|${language}|${text}`)
      .digest('hex');
  }
}
