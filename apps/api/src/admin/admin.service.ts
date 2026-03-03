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

  // ─── Revenue ───

  async getRevenue() {
    const [proUsers, freeUsers] = await Promise.all([
      this.prisma.profile.count({ where: { plan: 'PRO' } }),
      this.prisma.profile.count({ where: { plan: 'FREE' } }),
    ]);

    const planBreakdown = await this.prisma.profile.groupBy({
      by: ['stripePriceId'],
      where: { plan: 'PRO' },
      _count: { _all: true },
    });

    const subscriptionStatuses = await this.prisma.profile.groupBy({
      by: ['subscriptionStatus'],
      where: { plan: 'PRO' },
      _count: { _all: true },
    });

    const recentSubscriptions = await this.prisma.profile.findMany({
      where: { plan: 'PRO' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        email: true,
        username: true,
        stripePriceId: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        createdAt: true,
      },
    });

    return {
      proUsers,
      freeUsers,
      planBreakdown: planBreakdown.map((g) => ({
        priceId: g.stripePriceId,
        count: g._count._all,
      })),
      subscriptionStatuses: subscriptionStatuses.map((g) => ({
        status: g.subscriptionStatus,
        count: g._count._all,
      })),
      recentSubscriptions,
    };
  }

  // ─── Growth ───

  async getGrowth(days: number) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days);

    const [signupsRaw, generationsRaw, activeUsersRaw] = await Promise.all([
      this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE("created_at") as date, COUNT(*)::bigint as count
        FROM "profiles"
        WHERE "created_at" >= ${since}
        GROUP BY DATE("created_at")
        ORDER BY date
      `,
      this.prisma.$queryRaw<
        { date: Date; flashcard_sets: bigint; quizzes: bigint }[]
      >`
        SELECT "date",
               SUM("flashcard_sets")::bigint as flashcard_sets,
               SUM("quizzes")::bigint as quizzes
        FROM "daily_usage"
        WHERE "date" >= ${since}
        GROUP BY "date"
        ORDER BY "date"
      `,
      this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE("started_at") as date, COUNT(DISTINCT "user_id")::bigint as count
        FROM "study_sessions"
        WHERE "started_at" >= ${since}
        GROUP BY DATE("started_at")
        ORDER BY date
      `,
    ]);

    return {
      signups: signupsRaw.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      generations: generationsRaw.map((r) => ({
        date: r.date,
        flashcard_sets: Number(r.flashcard_sets),
        quizzes: Number(r.quizzes),
      })),
      activeUsers: activeUsersRaw.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
    };
  }

  // ─── Flashcard Sets ───

  async getFlashcardSets(params: {
    page?: number;
    limit?: number;
    search?: string;
    userId?: string;
  }) {
    const { page = 1, limit = 20, search, userId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (userId) {
      where.userId = userId;
    }

    const [flashcardSets, total] = await Promise.all([
      this.prisma.flashcardSet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, username: true } },
          _count: { select: { flashcards: true } },
        },
      }),
      this.prisma.flashcardSet.count({ where }),
    ]);

    return {
      flashcardSets,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getFlashcardSet(id: string) {
    return this.prisma.flashcardSet.findUnique({
      where: { id },
      include: {
        flashcards: { orderBy: { sortOrder: 'asc' } },
        user: { select: { id: true, email: true, username: true } },
      },
    });
  }

  // ─── Quizzes ───

  async getQuizzes(params: {
    page?: number;
    limit?: number;
    search?: string;
    userId?: string;
  }) {
    const { page = 1, limit = 20, search, userId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (userId) {
      where.userId = userId;
    }

    const [quizzes, total] = await Promise.all([
      this.prisma.quiz.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, username: true } },
          _count: { select: { questions: true } },
        },
      }),
      this.prisma.quiz.count({ where }),
    ]);

    return {
      quizzes,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getQuiz(id: string) {
    return this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        user: { select: { id: true, email: true, username: true } },
      },
    });
  }

  // ─── Leagues ───

  async getLeagues(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [leagues, total] = await Promise.all([
      this.prisma.league.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { members: true } },
          owner: { select: { id: true, username: true } },
        },
      }),
      this.prisma.league.count({ where }),
    ]);

    return {
      leagues,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getLeague(id: string) {
    return this.prisma.league.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
          },
        },
        owner: { select: { id: true, username: true } },
        _count: {
          select: {
            members: true,
            sessions: true,
            feedPosts: true,
            chatMessages: true,
          },
        },
      },
    });
  }

  // ─── Documents ───

  async getDocuments(params: {
    page?: number;
    limit?: number;
    search?: string;
    userId?: string;
  }) {
    const { page = 1, limit = 20, search, userId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (userId) {
      where.userId = userId;
    }

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, username: true } },
          _count: { select: { flashcardSets: true, quizzes: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
}
