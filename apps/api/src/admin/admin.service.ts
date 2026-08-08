import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  // Conceder e remover selo deixa rastro: é uma ação de curadoria, e daqui a
  // seis meses "quem verificou esse perfil?" é uma pergunta que alguém faz.
  private readonly logger = new Logger(AdminService.name);

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

  /**
   * Concede ou remove o selo de verificado.
   *
   * Só existe aqui. Não há rota de usuário que alcance esta coluna, e é o que
   * mantém o selo significando "é mesmo essa pessoa" em vez de "pagou" — ver a
   * nota em `Profile.verified`.
   *
   * Devolve o perfil já atualizado para o painel não precisar reconsultar, e
   * porque um `PATCH` que responde vazio obriga quem chama a supor que deu
   * certo.
   */
  async setVerified(userId: string, verification: 'BLUE' | 'GOLD' | null) {
    const existe = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('User not found');

    const perfil = await this.prisma.profile.update({
      where: { id: userId },
      data: { verification },
      select: { id: true, username: true, handle: true, verification: true },
    });

    this.logger.log(
      verification
        ? `Selo ${verification} concedido: ${perfil.handle} (${userId})`
        : `Selo removido: ${perfil.handle} (${userId})`,
    );

    return perfil;
  }

  // ─── Revenue ───

  async getRevenue() {
    const [proUsers, freeUsers] = await Promise.all([
      this.prisma.profile.count({ where: { plan: 'PRO' } }),
      this.prisma.profile.count({ where: { plan: 'FREE' } }),
    ]);

    const planBreakdown = await this.prisma.profile.groupBy({
      by: ['subscriptionPlatform'],
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
        subscriptionPlatform: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        createdAt: true,
      },
    });

    return {
      proUsers,
      freeUsers,
      planBreakdown: planBreakdown.map((g) => ({
        platform: g.subscriptionPlatform,
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

  // ─── AI cost (Fase 0, Bloco 4) ───

  /** Cost and token spend per calendar day, most recent first. */
  async getAiCostsByDay(days: number) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days);

    const rows = await this.prisma.aiUsageLedger.groupBy({
      by: ['date'],
      where: { date: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
      _count: { _all: true },
      orderBy: { date: 'desc' },
    });

    return rows.map((r) => ({
      date: r.date,
      calls: r._count._all,
      input_tokens: r._sum.inputTokens ?? 0,
      output_tokens: r._sum.outputTokens ?? 0,
      estimated_cost_usd: Number(r._sum.estimatedCostUsd ?? 0),
    }));
  }

  /** Cost and token spend per user over the window, most expensive first. */
  async getAiCostsByUser(params: { days?: number; page?: number; limit?: number }) {
    const { days = 30, page = 1, limit = 20 } = params;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days);

    const grouped = await this.prisma.aiUsageLedger.groupBy({
      by: ['userId'],
      where: { date: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
      _count: { _all: true },
    });

    const sorted = grouped.sort(
      (a, b) => Number(b._sum.estimatedCostUsd ?? 0) - Number(a._sum.estimatedCostUsd ?? 0),
    );
    const total = sorted.length;
    const page_rows = sorted.slice((page - 1) * limit, (page - 1) * limit + limit);

    const users = await this.prisma.profile.findMany({
      where: { id: { in: page_rows.map((r) => r.userId) } },
      select: { id: true, email: true, username: true, plan: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return {
      users: page_rows.map((r) => ({
        user: userById.get(r.userId) ?? { id: r.userId, email: null, username: null, plan: null },
        calls: r._count._all,
        input_tokens: r._sum.inputTokens ?? 0,
        output_tokens: r._sum.outputTokens ?? 0,
        estimated_cost_usd: Number(r._sum.estimatedCostUsd ?? 0),
      })),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

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
