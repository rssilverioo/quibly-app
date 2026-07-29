import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class UsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async checkUsageLimit(
    userId: string,
    type: 'flashcard_sets' | 'quizzes' | 'audio_sessions',
  ): Promise<{ allowed: boolean; used: number; limit: number }> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const plan = profile?.plan || 'FREE';
    const limit = await this.entitlements.getLimit(plan, type);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await this.prisma.dailyUsage.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    const field = this.fieldFor(type);
    const used = usage?.[field] ?? 0;

    return {
      allowed: used < limit,
      used,
      limit: limit === Infinity ? -1 : limit,
    };
  }

  async incrementUsage(
    userId: string,
    type: 'flashcard_sets' | 'quizzes' | 'audio_sessions',
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const field = this.fieldFor(type);

    await this.prisma.dailyUsage.upsert({
      where: { userId_date: { userId, date: today } },
      create: {
        userId,
        date: today,
        [field]: 1,
      },
      update: {
        [field]: { increment: 1 },
      },
    });
  }

  async getUsage(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const plan = profile?.plan || 'FREE';
    const limits = await this.entitlements.getLimits(plan);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await this.prisma.dailyUsage.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    return {
      plan,
      flashcard_sets: {
        used: usage?.flashcardSets ?? 0,
        limit: limits.flashcard_sets === Infinity ? -1 : limits.flashcard_sets,
      },
      quizzes: {
        used: usage?.quizzes ?? 0,
        limit: limits.quizzes === Infinity ? -1 : limits.quizzes,
      },
      audio_sessions: {
        used: usage?.audioSessions ?? 0,
        limit: limits.audio_sessions === Infinity ? -1 : limits.audio_sessions,
      },
    };
  }

  private fieldFor(
    type: 'flashcard_sets' | 'quizzes' | 'audio_sessions',
  ): 'flashcardSets' | 'quizzes' | 'audioSessions' {
    if (type === 'flashcard_sets') return 'flashcardSets';
    if (type === 'audio_sessions') return 'audioSessions';
    return 'quizzes';
  }
}
