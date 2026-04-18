import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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

export type AudioScriptSegmentType =
  | 'intro'
  | 'card_q'
  | 'card_a'
  | 'quiz_q'
  | 'quiz_a'
  | 'explain'
  | 'recap'
  | 'close';

export interface AudioScriptSegment {
  type: AudioScriptSegmentType;
  text: string;
  pauseAfterMs: number;
  cardId?: string;
}

export interface AudioScriptFlashcardInput {
  id: string;
  front: string;
  back: string;
  explain?: string | null;
}

const MODEL = 'gpt-4o-mini';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private client: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
      if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  private async chatJSON<T>(prompt: string): Promise<T> {
    const client = this.getClient();
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON. IMPORTANT: If the user content/topic is written in a specific language (e.g. Portuguese, Spanish), generate ALL output in that same language regardless of the language parameter. Auto-detect the input language.' },
        { role: 'user', content: prompt },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';
    this.logger.log(`AI response length: ${text.length} chars`);
    return JSON.parse(text) as T;
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

Return a JSON object with shape: { "flashcards": [ { "front": "...", "back": "...", "explain": "...", "imageQuery": "..." } ] }

Content to study:
${textContent}`;

    const result = await this.chatJSON<{ flashcards: GeneratedFlashcard[] }>(prompt);
    const flashcards = result.flashcards ?? [];
    this.logger.log(`Generated ${flashcards.length} flashcards`);
    return flashcards;
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
- CRITICAL: You MUST distribute correct answers EVENLY across all 4 positions. Each index (0, 1, 2, 3) must be used roughly equally. Count them before responding. If more than 30% of answers have the same index, redistribute. This is the most important rule.
- "imageQuery": 3-5 English words to search a relevant educational image.
- Mix question types: factual recall, conceptual understanding, application, comparison, true analysis.
- Cover the ENTIRE content, not just the first paragraphs.
- Language for question/options: ${language}
- imageQuery must ALWAYS be in English regardless of content language.

Return a JSON object with shape: { "questions": [ { "question": "...", "options": ["..."], "correctIndex": 0, "imageQuery": "..." } ] }

Content to quiz on:
${textContent}`;

    const result = await this.chatJSON<{ questions: GeneratedQuestion[] }>(prompt);
    const questions = result.questions ?? [];
    this.logger.log(`Generated ${questions.length} questions, pre-shuffle distribution: ${JSON.stringify(this.getDistribution(questions))}`);
    const shuffled = this.shuffleAnswers(questions);
    this.logger.log(`Post-shuffle distribution: ${JSON.stringify(this.getDistribution(shuffled))}`);
    return shuffled;
  }

  private shuffleAnswers(questions: GeneratedQuestion[]): GeneratedQuestion[] {
    return questions.map((q) => {
      const correctAnswer = q.options[q.correctIndex];
      const shuffled = [...q.options];

      // Fisher-Yates shuffle
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      return {
        ...q,
        options: shuffled,
        correctIndex: shuffled.indexOf(correctAnswer),
      };
    });
  }

  private getDistribution(questions: GeneratedQuestion[]): Record<number, number> {
    const dist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const q of questions) {
      dist[q.correctIndex] = (dist[q.correctIndex] || 0) + 1;
    }
    return dist;
  }

  async planAudioScript(
    flashcards: AudioScriptFlashcardInput[],
    durationMinutes: number,
    language = 'en',
    userName?: string,
  ): Promise<AudioScriptSegment[]> {
    this.logger.log(`Planning audio script: ${flashcards.length} cards, ${durationMinutes}min, lang=${language}`);

    const cardsPreview = flashcards
      .map((c) => `- id=${c.id} | Q: ${c.front} | A: ${c.back}`)
      .join('\n');

    const greeting = userName ? `Address the user as "${userName}" in the intro.` : 'Use a friendly neutral greeting.';

    const prompt = `You are a friendly AI study coach narrating a ${durationMinutes}-minute audio study session in ${language}. Generate a complete script as a JSON array of segments. Audio will be converted via text-to-speech, so write natural spoken language (no markdown, no bullet points, no code). The total spoken duration must be close to ${durationMinutes} minutes assuming 150 words per minute.

STRUCTURE (in this order):
1. One "intro" segment (~30 seconds). Warm greeting. ${greeting} Say what you'll cover. Motivate briefly.
2. For each flashcard (cover ALL of them, but shuffle order so it's not sequential):
   - One "card_q" segment with JUST the question (say it naturally, e.g. "Next: <front>"). cardId = the flashcard id.
   - One "card_a" segment with the answer + brief explanation. cardId = same.
3. After every 5 cards, insert one "quiz_q" segment (a mini verbal quiz using cards just covered, multiple choice read aloud as "A, B, or C") followed by a "quiz_a" segment confirming the answer.
4. One "explain" segment near the end (~30-60s) that highlights 2-3 of the trickiest or most important concepts from the cards.
5. One "recap" segment (~60s) listing the key ideas.
6. One "close" segment (~20s) congratulating, mentioning streak, inviting them back tomorrow.

SEGMENT FIELDS:
- "type": one of "intro" | "card_q" | "card_a" | "quiz_q" | "quiz_a" | "explain" | "recap" | "close"
- "text": the spoken text (natural, conversational, ${language})
- "pauseAfterMs": silence after this segment in milliseconds. Use 4000 after card_q (thinking time), 3000 after quiz_q, 800 for other transitions, 1500 before recap/close.
- "cardId": ONLY on card_q and card_a segments, set to the flashcard's id.

Flashcards to cover:
${cardsPreview}

Return a JSON object with shape: { "segments": [ ... ] }`;

    const result = await this.chatJSON<{ segments: AudioScriptSegment[] }>(prompt);

    if (!result?.segments || !Array.isArray(result.segments)) {
      throw new Error('AI returned invalid audio script shape');
    }

    this.logger.log(`Generated ${result.segments.length} audio segments`);
    return result.segments;
  }

  async extractTextFromImage(buffer: Buffer): Promise<string> {
    const client = this.getClient();
    const base64 = buffer.toString('base64');

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all text from this image. Return only the extracted text, nothing else.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
          ],
        },
      ],
    });

    return response.choices[0]?.message?.content ?? '';
  }
}
