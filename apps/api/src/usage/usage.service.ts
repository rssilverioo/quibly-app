import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { USAGE_LIMITS } from '@quibly/shared';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async checkUsageLimit(
    userId: string,
    type: 'flashcard_sets' | 'quizzes',
  ): Promise<{ allowed: boolean; used: number; limit: number }> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const plan = profile?.plan || 'FREE';
    const limit = USAGE_LIMITS[plan][type];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await this.prisma.dailyUsage.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    const used = usage?.[type === 'flashcard_sets' ? 'flashcardSets' : 'quizzes'] ?? 0;

    return {
      allowed: used < limit,
      used,
      limit: limit === Infinity ? -1 : limit,
    };
  }

  async incrementUsage(
    userId: string,
    type: 'flashcard_sets' | 'quizzes',
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const field = type === 'flashcard_sets' ? 'flashcardSets' : 'quizzes';

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
    const limits = USAGE_LIMITS[plan];

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
    };
  }
}
