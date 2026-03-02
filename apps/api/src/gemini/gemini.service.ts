import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

interface GeneratedFlashcard {
  front: string;
  back: string;
  explain: string;
  imageQuery: string;
}

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  imageQuery: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private model: GenerativeModel | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getModel(): GenerativeModel {
    if (!this.model) {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      });
    }
    return this.model;
  }

  async generateFlashcards(
    content: string,
    language = 'en',
  ): Promise<GeneratedFlashcard[]> {
    const prompt = `You are an expert educator. Create 10-15 high-quality flashcards from the following content.
Each flashcard must have:
- "front": the question or concept (concise)
- "back": the answer or definition (clear and complete)
- "explain": a brief explanation to help understand why (1-2 sentences)
- "imageQuery": a short English search query (3-5 words) to find a relevant educational image

Language for front/back/explain: ${language}
imageQuery must always be in English.

Return a JSON array of flashcard objects. Only return the JSON array, nothing else.

Content:
${content.slice(0, 30000)}`;

    const model = this.getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
      return JSON.parse(text);
    } catch {
      this.logger.warn('Failed to parse flashcards JSON, attempting cleanup');
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    }
  }

  async generateQuiz(
    content: string,
    language = 'en',
  ): Promise<GeneratedQuestion[]> {
    const prompt = `You are an expert educator. Create 7-20 multiple-choice questions from the following content.
Each question must have:
- "question": the question text
- "options": exactly 4 answer options as a string array
- "correctIndex": the 0-based index of the correct option
- "imageQuery": a short English search query (3-5 words) to find a relevant educational image

Language for question/options: ${language}
imageQuery must always be in English.

Return a JSON array of question objects. Only return the JSON array, nothing else.

Content:
${content.slice(0, 30000)}`;

    const model = this.getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
      return JSON.parse(text);
    } catch {
      this.logger.warn('Failed to parse quiz JSON, attempting cleanup');
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    }
  }

  async extractTextFromImage(buffer: Buffer): Promise<string> {
    const model = this.getModel();
    const result = await model.generateContent([
      'Extract all text from this image. Return only the extracted text, nothing else.',
      {
        inlineData: {
          mimeType: 'image/png',
          data: buffer.toString('base64'),
        },
      },
    ]);
    return result.response.text();
  }
}
