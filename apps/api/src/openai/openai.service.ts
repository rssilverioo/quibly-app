import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type OpenAiVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

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
}
