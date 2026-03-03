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
          temperature: 0.7,
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
    const textContent = content.slice(0, 50000);
    this.logger.log(`Generating flashcards from ${textContent.length} chars, language=${language}`);

    const prompt = `You are a world-class educator creating study flashcards. Analyze the content below and create between 15 and 30 flashcards that cover ALL the key concepts, definitions, facts, and important details.

RULES:
- Create as many cards as the content deserves. Short content = 10-15 cards. Long detailed content = 20-30 cards.
- "front": A short, clear question or term (max 15 words). Be specific, not vague.
- "back": A concise, direct answer (max 30 words). No filler words.
- "explain": One sentence explaining WHY this is important or HOW to remember it.
- "imageQuery": 3-5 English words to search a relevant image (e.g. "cell mitosis diagram", "french revolution painting").
- Cover the ENTIRE content, not just the beginning.
- Mix different types: definitions, cause/effect, comparisons, key facts, formulas, dates.
- Language for front/back/explain: ${language}
- imageQuery must ALWAYS be in English regardless of content language.

Return ONLY a JSON array of objects with keys: front, back, explain, imageQuery.

Content to study:
${textContent}`;

    const model = this.getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    this.logger.log(`Flashcards raw response length: ${text.length}`);

    try {
      const parsed = JSON.parse(text);
      this.logger.log(`Generated ${parsed.length} flashcards`);
      return parsed;
    } catch {
      this.logger.warn('Failed to parse flashcards JSON, attempting cleanup');
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      this.logger.log(`Generated ${parsed.length} flashcards (after cleanup)`);
      return parsed;
    }
  }

  async generateQuiz(
    content: string,
    language = 'en',
  ): Promise<GeneratedQuestion[]> {
    const textContent = content.slice(0, 50000);
    this.logger.log(`Generating quiz from ${textContent.length} chars, language=${language}`);

    const prompt = `You are a world-class educator creating a multiple-choice quiz. Analyze the content below and create between 15 and 30 questions that thoroughly test understanding.

CRITICAL RULES:
- Create as many questions as the content deserves. Short content = 10-15. Long detailed content = 20-30.
- "question": Clear, specific question (not vague or ambiguous).
- "options": EXACTLY 4 plausible answer choices. Wrong answers must be realistic distractors, not obviously wrong.
- "correctIndex": The 0-based index (0, 1, 2, or 3) of the correct answer.
- IMPORTANT: Distribute correct answers EVENLY across all 4 positions. Roughly 25% should be index 0, 25% index 1, 25% index 2, 25% index 3. NEVER put most correct answers in the same position.
- "imageQuery": 3-5 English words to search a relevant educational image.
- Mix question types: factual recall, conceptual understanding, application, comparison, true analysis.
- Cover the ENTIRE content, not just the first paragraphs.
- Language for question/options: ${language}
- imageQuery must ALWAYS be in English regardless of content language.

Return ONLY a JSON array of objects with keys: question, options, correctIndex, imageQuery.

Content to quiz on:
${textContent}`;

    const model = this.getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    this.logger.log(`Quiz raw response length: ${text.length}`);

    try {
      const parsed = JSON.parse(text) as GeneratedQuestion[];
      this.logger.log(`Generated ${parsed.length} questions, correctIndex distribution: ${JSON.stringify(this.getDistribution(parsed))}`);
      return parsed;
    } catch {
      this.logger.warn('Failed to parse quiz JSON, attempting cleanup');
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as GeneratedQuestion[];
      this.logger.log(`Generated ${parsed.length} questions (after cleanup)`);
      return parsed;
    }
  }

  private getDistribution(questions: GeneratedQuestion[]): Record<number, number> {
    const dist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const q of questions) {
      dist[q.correctIndex] = (dist[q.correctIndex] || 0) + 1;
    }
    return dist;
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
