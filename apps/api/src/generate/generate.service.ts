import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { ImageSearchService } from '../image-search/image-search.service';
import { UsageService } from '../usage/usage.service';
import { AiRouterService } from '../ai-router/ai-router.service';

@Injectable()
export class GenerateService {
  private readonly logger = new Logger(GenerateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly imageSearchService: ImageSearchService,
    private readonly usageService: UsageService,
    // Everything that actually calls the model for flashcards/quiz goes
    // through AiRouter instead of GeminiService directly: it picks the model
    // per task, debits the daily token budget, caches deterministic content
    // by hash (skips re-paying for the same document+language), and writes
    // the AiUsageLedger row. `geminiService` stays injected for `explainCard`,
    // which isn't migrated yet — see the Fase 0 handoff report.
    private readonly aiRouter: AiRouterService,
  ) {}

  async generateFlashcardsFromDocument(userId: string, documentId: string, language?: string) {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.userId !== userId) throw new ForbiddenException();
    if (!doc.extractedText) throw new BadRequestException('Document has no extracted text');

    this.logger.log(`Document "${doc.title}" has ${doc.extractedText.length} chars of extracted text`);

    const usage = await this.usageService.checkUsageLimit(userId, 'flashcard_sets');
    if (!usage.allowed) {
      throw new BadRequestException(
        `Daily flashcard set limit reached (${usage.used}/${usage.limit}). Upgrade to PRO for unlimited.`,
      );
    }

    const cards = await this.aiRouter.generateFlashcards(userId, doc.extractedText, language || 'en');
    this.logger.log(`Generated ${cards.length} flashcards for "${doc.title}"`);

    // Search images in parallel (batch of 5 to avoid rate limits)
    const cardsWithImages = [];
    for (let i = 0; i < cards.length; i += 5) {
      const batch = cards.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (card, batchIndex) => {
          const imageUrl = card.imageQuery
            ? await this.imageSearchService.searchImage(card.imageQuery)
            : null;
          return { ...card, imageUrl, sortOrder: i + batchIndex };
        }),
      );
      cardsWithImages.push(...results);
    }

    const withImages = cardsWithImages.filter((c) => c.imageUrl).length;
    this.logger.log(`Images found: ${withImages}/${cardsWithImages.length}`);

    const set = await this.prisma.flashcardSet.create({
      data: {
        userId,
        documentId,
        title: doc.title,
        language: language || 'en',
        flashcards: {
          create: cardsWithImages.map((card) => ({
            front: card.front,
            back: card.back,
            explain: card.explain,
            imageUrl: card.imageUrl,
            sortOrder: card.sortOrder,
          })),
        },
      },
      include: {
        flashcards: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.usageService.incrementUsage(userId, 'flashcard_sets');
    return set;
  }

  async generateQuizFromDocument(userId: string, documentId: string, language?: string) {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.userId !== userId) throw new ForbiddenException();
    if (!doc.extractedText) throw new BadRequestException('Document has no extracted text');

    this.logger.log(`Document "${doc.title}" has ${doc.extractedText.length} chars of extracted text`);

    const usage = await this.usageService.checkUsageLimit(userId, 'quizzes');
    if (!usage.allowed) {
      throw new BadRequestException(
        `Daily quiz limit reached (${usage.used}/${usage.limit}). Upgrade to PRO for unlimited.`,
      );
    }

    const questions = await this.aiRouter.generateQuiz(userId, doc.extractedText, language || 'en');
    this.logger.log(`Generated ${questions.length} quiz questions for "${doc.title}"`);

    // Search images in parallel (batch of 5 to avoid rate limits)
    const questionsWithImages = [];
    for (let i = 0; i < questions.length; i += 5) {
      const batch = questions.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (q, batchIndex) => {
          const imageUrl = q.imageQuery
            ? await this.imageSearchService.searchImage(q.imageQuery)
            : null;
          return { ...q, imageUrl, sortOrder: i + batchIndex };
        }),
      );
      questionsWithImages.push(...results);
    }

    const withImages = questionsWithImages.filter((q) => q.imageUrl).length;
    this.logger.log(`Images found: ${withImages}/${questionsWithImages.length}`);

    const quiz = await this.prisma.quiz.create({
      data: {
        userId,
        documentId,
        title: doc.title,
        language: language || 'en',
        totalQ: questionsWithImages.length,
        questions: {
          create: questionsWithImages.map((q) => ({
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            imageUrl: q.imageUrl,
            sortOrder: q.sortOrder,
          })),
        },
      },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.usageService.incrementUsage(userId, 'quizzes');
    return quiz;
  }

  /**
   * Look up illustrations for generated items, 5 at a time so the image
   * provider doesn't rate-limit us.
   */
  private async attachImages<T extends { imageQuery?: string }>(
    items: T[],
  ): Promise<(T & { imageUrl: string | null; sortOrder: number })[]> {
    const out: (T & { imageUrl: string | null; sortOrder: number })[] = [];

    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (item, batchIndex) => {
          const imageUrl = item.imageQuery
            ? await this.imageSearchService.searchImage(item.imageQuery)
            : null;
          return { ...item, imageUrl, sortOrder: i + batchIndex };
        }),
      );
      out.push(...results);
    }

    return out;
  }

  /**
   * Derive study material from a captured lesson.
   *
   * Generates from the lesson's raw capture rather than its summary — the
   * summary is deliberately lossy, and flashcards built from it inherit the
   * loss.
   */
  async generateFromLesson(
    userId: string,
    lessonId: string,
    type: 'flashcards' | 'quiz',
  ) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.userId !== userId) throw new ForbiddenException();
    if (!lesson.rawText?.trim()) {
      throw new BadRequestException('Lesson has not been processed yet');
    }

    const usageType = type === 'flashcards' ? 'flashcard_sets' : 'quizzes';
    const usage = await this.usageService.checkUsageLimit(userId, usageType);
    if (!usage.allowed) {
      throw new BadRequestException(
        `Daily ${usageType} limit reached (${usage.used}/${usage.limit}). Upgrade to PRO for unlimited.`,
      );
    }

    const { language, title } = lesson;

    if (type === 'flashcards') {
      const cards = await this.aiRouter.generateFlashcards(userId, lesson.rawText, language);
      const withImages = await this.attachImages(cards);

      const set = await this.prisma.flashcardSet.create({
        data: {
          userId,
          lessonId,
          documentId: lesson.documentId,
          title,
          language,
          flashcards: {
            create: withImages.map((card) => ({
              front: card.front,
              back: card.back,
              explain: card.explain,
              imageUrl: card.imageUrl,
              sortOrder: card.sortOrder,
            })),
          },
        },
        include: { flashcards: { orderBy: { sortOrder: 'asc' } } },
      });

      await this.usageService.incrementUsage(userId, 'flashcard_sets');
      return set;
    }

    const questions = await this.aiRouter.generateQuiz(userId, lesson.rawText, language);
    const withImages = await this.attachImages(questions);

    const quiz = await this.prisma.quiz.create({
      data: {
        userId,
        lessonId,
        documentId: lesson.documentId,
        title,
        language,
        totalQ: withImages.length,
        questions: {
          create: withImages.map((q) => ({
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            imageUrl: q.imageUrl,
            sortOrder: q.sortOrder,
          })),
        },
      },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.usageService.incrementUsage(userId, 'quizzes');
    return quiz;
  }

  async generateFromTopic(
    userId: string,
    topic: string,
    type: 'flashcards' | 'quiz',
    language?: string,
  ) {
    const usageType = type === 'flashcards' ? 'flashcard_sets' : 'quizzes';
    const usage = await this.usageService.checkUsageLimit(userId, usageType);
    if (!usage.allowed) {
      throw new BadRequestException(
        `Daily ${usageType} limit reached (${usage.used}/${usage.limit}). Upgrade to PRO for unlimited.`,
      );
    }

    // Auto-detect language from topic text if language is 'en' but topic looks non-English
    const detectedLang = language && language !== 'en' ? language : this.detectLanguage(topic);
    const content = topic;

    if (type === 'flashcards') {
      const cards = await this.aiRouter.generateFlashcards(userId, content, detectedLang);
      const cardsWithImages = await Promise.all(
        cards.map(async (card, index) => {
          const imageUrl = card.imageQuery
            ? await this.imageSearchService.searchImage(card.imageQuery)
            : null;
          return { ...card, imageUrl, sortOrder: index };
        }),
      );

      const set = await this.prisma.flashcardSet.create({
        data: {
          userId,
          title: topic,
          language: language || 'en',
          flashcards: {
            create: cardsWithImages.map((card) => ({
              front: card.front,
              back: card.back,
              explain: card.explain,
              imageUrl: card.imageUrl,
              sortOrder: card.sortOrder,
            })),
          },
        },
        include: {
          flashcards: { orderBy: { sortOrder: 'asc' } },
        },
      });

      await this.usageService.incrementUsage(userId, 'flashcard_sets');
      return set;
    } else {
      const questions = await this.aiRouter.generateQuiz(userId, content, detectedLang);
      const questionsWithImages = await Promise.all(
        questions.map(async (q, index) => {
          const imageUrl = q.imageQuery
            ? await this.imageSearchService.searchImage(q.imageQuery)
            : null;
          return { ...q, imageUrl, sortOrder: index };
        }),
      );

      const quiz = await this.prisma.quiz.create({
        data: {
          userId,
          title: topic,
          language: language || 'en',
          totalQ: questionsWithImages.length,
          questions: {
            create: questionsWithImages.map((q) => ({
              question: q.question,
              options: q.options,
              correctIndex: q.correctIndex,
              imageUrl: q.imageUrl,
              sortOrder: q.sortOrder,
            })),
          },
        },
        include: {
          questions: { orderBy: { sortOrder: 'asc' } },
        },
      });

      await this.usageService.incrementUsage(userId, 'quizzes');
      return quiz;
    }
  }

  async explainCard(front: string, back: string, explain?: string, language?: string) {
    const lang = language || this.detectLanguage(front + ' ' + back);
    const prompt = `You are a friendly tutor explaining a study concept to a student. The student just saw this flashcard:

Question: ${front}
Answer: ${back}
${explain ? `Explanation: ${explain}` : ''}

Generate TWO things in ${lang}:
1. "simple": Explain this concept like you're talking to a 10-year-old. Use a real-world analogy or example. 2-3 sentences max. Be fun and memorable.
2. "mnemonic": Create a short memory trick, acronym, or rhyme to help remember this. 1 sentence.

Return JSON: { "simple": "...", "mnemonic": "..." }`;

    return this.geminiService.chatJSON<{ simple: string; mnemonic: string }>(prompt);
  }

  private detectLanguage(text: string): string {
    const lower = text.toLowerCase();
    // Portuguese indicators
    if (/[àáâãçéêíóôõúü]/.test(lower)) return 'pt-BR';
    if (/\b(sobre|como|para|uma|dos|das|que|história|ciência|matemática)\b/.test(lower)) return 'pt-BR';
    // Spanish indicators
    if (/[ñ¿¡]/.test(lower)) return 'es';
    if (/\b(sobre|como|para|una|los|las|que|historia|ciencia)\b/.test(lower) && /ñ/.test(lower)) return 'es';
    return 'en';
  }
}
