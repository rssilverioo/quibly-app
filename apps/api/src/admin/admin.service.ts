import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [
      totalUsers,
      proUsers,
      totalDocuments,
      totalFlashcardSets,
      totalQuizzes,
    ] = await Promise.all([
      this.prisma.profile.count(),
      this.prisma.profile.count({ where: { plan: 'PRO' } }),
      this.prisma.document.count(),
      this.prisma.flashcardSet.count(),
      this.prisma.quiz.count(),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const generationsToday = await this.prisma.dailyUsage.aggregate({
      where: { date: today },
      _sum: { flashcardSets: true, quizzes: true },
    });

    return {
      total_users: totalUsers,
      pro_users: proUsers,
      total_documents: totalDocuments,
      total_flashcard_sets: totalFlashcardSets,
      total_quizzes: totalQuizzes,
      generations_today: {
        flashcard_sets: generationsToday._sum.flashcardSets ?? 0,
        quizzes: generationsToday._sum.quizzes ?? 0,
      },
    };
  }

  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    plan?: 'FREE' | 'PRO';
    sort?: string;
  }) {
    const { page = 1, limit = 20, search, plan, sort = 'created_at_desc' } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { handle: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (plan) {
      where.plan = plan;
    }

    const [sortField, sortDir] = sort.split('_desc').length > 1
      ? [sort.replace('_desc', ''), 'desc']
      : [sort.replace('_asc', ''), 'asc'];

    const orderByMap: Record<string, any> = {
      created_at: { createdAt: sortDir },
      total_xp: { totalXp: sortDir },
      level: { level: sortDir },
    };

    const orderBy = orderByMap[sortField] || { createdAt: 'desc' };

    const [users, total] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              documents: true,
              flashcardSets: true,
              quizzes: true,
              studySessions: true,
            },
          },
        },
      }),
      this.prisma.profile.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getUser(userId: string) {
    return this.prisma.profile.findUnique({
      where: { id: userId },
      include: {
        documents: { orderBy: { createdAt: 'desc' }, take: 10 },
        flashcardSets: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { _count: { select: { flashcards: true } } },
        },
        quizzes: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { _count: { select: { questions: true } } },
        },
        _count: {
          select: {
            documents: true,
            flashcardSets: true,
            quizzes: true,
            studySessions: true,
            userAchievements: true,
          },
        },
      },
    });
  }
}
