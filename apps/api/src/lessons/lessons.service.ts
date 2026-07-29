import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PDFParse } from 'pdf-parse';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeminiService } from '../gemini/gemini.service';
import { OpenaiService } from '../openai/openai.service';
import { AnalyticsService } from '../analytics/analytics.service';
import type { LessonSource } from '@prisma/client';

/**
 * Below this, a capture didn't produce enough to structure — a 20-second
 * recording of someone fumbling with the phone, or a photo of a blank page.
 * Failing loudly beats generating a confident summary of nothing.
 */
const MIN_USABLE_CHARS = 120;

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly gemini: GeminiService,
    private readonly openai: OpenaiService,
    private readonly analytics: AnalyticsService,
  ) {}

  /**
   * Accept a capture and start processing it.
   *
   * Returns as soon as the row exists — transcription plus structuring takes
   * tens of seconds, and the client polls. Holding the upload request open
   * that long would time out behind any proxy.
   */
  async capture(
    userId: string,
    file: Express.Multer.File,
    opts: { title?: string; subject?: string; language?: string; durationSec?: number },
  ) {
    if (!file) throw new BadRequestException('File is required');

    const source = this.sourceFor(file.mimetype);
    const language = opts.language || 'pt-BR';

    const key = `lessons/${userId}/${uuid()}-${file.originalname}`;
    await this.storage.uploadPrivate(key, file.buffer, file.mimetype);

    const lesson = await this.prisma.lesson.create({
      data: {
        userId,
        // Provisional: `process` replaces it with what the class was about.
        title: opts.title?.trim() || 'Processando…',
        subject: opts.subject,
        source,
        language,
        status: 'processing',
        audioKey: source === 'audio' ? key : null,
        durationSec: opts.durationSec ?? null,
      },
    });

    // Deliberately not awaited: the client polls GET /lessons/:id.
    void this.process(lesson.id, userId, source, file.buffer, file.originalname, file.mimetype, language)
      .catch((err) => this.logger.error(`Lesson ${lesson.id} failed: ${err}`));

    return lesson;
  }

  private sourceFor(mimeType: string): LessonSource {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'photo';
    if (mimeType === 'application/pdf') return 'document';
    throw new BadRequestException(`Unsupported capture type: ${mimeType}`);
  }

  /**
   * Capture → raw text → structured note.
   *
   * Every failure lands on the row as `failed` with a message, so the app can
   * tell the user what went wrong instead of spinning forever.
   */
  private async process(
    lessonId: string,
    userId: string,
    source: LessonSource,
    buffer: Buffer,
    filename: string,
    mimeType: string,
    language: string,
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      const rawText = await this.extractText(buffer, filename, mimeType, language);

      if (rawText.trim().length < MIN_USABLE_CHARS) {
        await this.fail(lessonId, userId, source, 'Not enough content in this capture to build a note');
        return;
      }

      const structured = await this.gemini.structureLesson(rawText, language);

      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: {
          status: 'ready',
          rawText,
          title: structured.title,
          summary: structured.summary,
          keyPoints: structured.keyPoints,
          openQuestions: structured.openQuestions,
          processedAt: new Date(),
        },
      });

      // [SERVER] lesson_ready — the AI loop closed. The client only polls
      // for this; it doesn't get to say when it happened.
      this.analytics.track(
        'lesson_ready',
        { userId },
        { source, processing_seconds: Math.round((Date.now() - startedAt) / 1000) },
      );

      this.logger.log(`Lesson ${lessonId} ready: "${structured.title}"`);
    } catch (err) {
      await this.fail(lessonId, userId, source, err instanceof Error ? err.message : String(err));
    }
  }

  private async extractText(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    language: string,
  ): Promise<string> {
    if (mimeType.startsWith('audio/')) {
      return this.openai.transcribe(buffer, filename, language);
    }

    if (mimeType === 'application/pdf') {
      try {
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const result = await parser.getText();
        await parser.destroy();
        if (result.text.trim().length >= MIN_USABLE_CHARS) return result.text;
        // A scanned PDF parses to almost nothing — fall through to OCR.
        this.logger.warn('PDF parsed to near-empty text, falling back to OCR');
      } catch (err) {
        this.logger.warn(`PDF parse failed, falling back to OCR: ${err}`);
      }
    }

    return this.gemini.extractTextFromImage(buffer);
  }

  private async fail(
    lessonId: string,
    userId: string,
    source: LessonSource,
    message: string,
  ): Promise<void> {
    this.logger.warn(`Lesson ${lessonId} failed: ${message}`);
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { status: 'failed', errorMessage: message },
    });
    // [SERVER] Pairs with lesson_ready — the other half of "did the loop close."
    this.analytics.track('lesson_processing_failed', { userId }, { source, reason: message });
  }

  async list(userId: string) {
    return this.prisma.lesson.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        subject: true,
        source: true,
        status: true,
        summary: true,
        durationSec: true,
        createdAt: true,
        _count: { select: { flashcardSets: true, quizzes: true } },
      },
    });
  }

  async get(userId: string, id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        flashcardSets: {
          include: { _count: { select: { flashcards: true } } },
          orderBy: { createdAt: 'desc' },
        },
        quizzes: {
          include: { _count: { select: { questions: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.userId !== userId) throw new ForbiddenException();

    return lesson;
  }

  /** Free-text question answered strictly from this lesson's capture. */
  async ask(userId: string, id: string, question: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.userId !== userId) throw new ForbiddenException();
    if (!lesson.rawText?.trim()) {
      throw new BadRequestException('Lesson has not been processed yet');
    }

    const prompt = `Answer the student's question using ONLY the class capture below.

If the capture doesn't cover it, say so plainly and point to the closest thing it does cover — never fill the gap with outside knowledge presented as part of the class.

Answer in ${lesson.language}, in at most 4 sentences.

Return JSON: { "answer": "...", "grounded": true | false }
"grounded" is false when the capture doesn't contain the answer.

Question: ${question}

Class capture:
${lesson.rawText.slice(0, 50000)}`;

    return this.gemini.chatJSON<{ answer: string; grounded: boolean }>(prompt);
  }

  async remove(userId: string, id: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.userId !== userId) throw new ForbiddenException();

    if (lesson.audioKey) {
      await this.storage.deleteObject(lesson.audioKey).catch((err) =>
        this.logger.warn(`Could not delete ${lesson.audioKey}: ${err}`),
      );
    }
    await this.prisma.lesson.delete({ where: { id } });

    return { deleted: true };
  }
}
