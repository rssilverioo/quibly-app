import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';

export type OpenAiVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

/** Whisper's hard upload ceiling. */
const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);
  private client: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async synthesize(
    text: string,
    voice: OpenAiVoice = 'alloy',
    language = 'en',
  ): Promise<Buffer> {
    if (!text.trim()) {
      throw new Error('Cannot synthesize empty text');
    }

    const client = this.getClient();
    const response = await client.audio.speech.create({
      model: 'tts-1',
      voice,
      input: text,
      response_format: 'mp3',
    });

    const arrayBuffer = await response.arrayBuffer();
    this.logger.log(`TTS generated ${arrayBuffer.byteLength} bytes for ${text.length} chars (voice=${voice}, lang=${language})`);
    return Buffer.from(arrayBuffer);
  }

  /**
   * Speech to text for a recorded class.
   *
   * `language` is an ISO-639-1 hint ("pt", "en"). Passing it materially
   * improves accuracy on Portuguese audio — Whisper otherwise guesses from
   * the first seconds, which are usually room noise.
   */
  async transcribe(
    audio: Buffer,
    filename: string,
    language?: string,
  ): Promise<string> {
    if (audio.length === 0) {
      throw new Error('Cannot transcribe empty audio');
    }
    if (audio.length > MAX_TRANSCRIBE_BYTES) {
      throw new Error(
        `Audio is ${Math.round(audio.length / 1024 / 1024)}MB; the limit is 25MB`,
      );
    }

    const client = this.getClient();
    const response = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: await toFile(audio, filename),
      // Whisper wants the bare subtag, not the full locale.
      language: language?.split('-')[0],
      response_format: 'text',
    });

    // With response_format: 'text' the SDK resolves to a plain string.
    const transcript = String(response).trim();
    this.logger.log(
      `Transcribed ${audio.length} bytes into ${transcript.length} chars (lang=${language ?? 'auto'})`,
    );
    return transcript;
  }
}
