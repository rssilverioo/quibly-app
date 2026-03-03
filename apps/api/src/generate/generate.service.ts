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

@Injectable()
export class GenerateService {
  private readonly logger = new Logger(GenerateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly imageSearchService: ImageSearchService,
    private readonly usageService: UsageService,
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

    const cards = await this.geminiService.generateFlashcards(doc.extractedText, language);
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

    const questions = await this.geminiService.generateQuiz(doc.extractedText, language);
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

    const content = `Topic: ${topic}. Generate comprehensive educational content about this topic.`;

    if (type === 'flashcards') {
      const cards = await this.geminiService.generateFlashcards(content, language);
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
      const questions = await this.geminiService.generateQuiz(content, language);
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
}
