import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ACHIEVEMENTS } from '@quibly/shared';

@Injectable()
export class AchievementsService implements OnModuleInit {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedAchievements();
    this.logger.log(`Seeded ${ACHIEVEMENTS.length} achievements`);
  }

  async getUserAchievements(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  async getAllAchievements(userId: string) {
    const [achievements, unlocked] = await Promise.all([
      this.prisma.achievement.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true, unlockedAt: true },
      }),
    ]);

    const unlockedMap = new Map(
      unlocked.map((u) => [u.achievementId, u.unlockedAt]),
    );

    return achievements.map((a) => ({
      ...a,
      unlocked: unlockedMap.has(a.id),
      unlocked_at: unlockedMap.get(a.id) ?? null,
    }));
  }

  async seedAchievements() {
    for (const a of ACHIEVEMENTS) {
      await this.prisma.achievement.upsert({
        where: { id: a.id },
        update: {
          name: a.name,
          description: a.description,
          icon: a.icon,
          category: a.category,
          threshold: a.threshold,
          sortOrder: a.sortOrder,
        },
        create: {
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.icon,
          category: a.category,
          threshold: a.threshold,
          sortOrder: a.sortOrder,
        },
      });
    }
  }

  /**
   * Check and award achievements after a session ends.
   * Returns newly unlocked achievement IDs.
   */
  async checkAfterSession(userId: string): Promise<string[]> {
    const [profile, sessionCount, verifiedCount, existingAchievements] =
      await Promise.all([
        this.prisma.profile.findUnique({
          where: { id: userId },
          select: {
            currentStreak: true,
            longestStreak: true,
            totalStudyMinutes: true,
            level: true,
          },
        }),
        this.prisma.studySession.count({
          where: { userId, status: 'completed' },
        }),
        this.prisma.studySession.count({
          where: { userId, status: 'completed', isVerified: true },
        }),
        this.prisma.userAchievement.findMany({
          where: { userId },
          select: { achievementId: true },
        }),
      ]);

    if (!profile) return [];

    const alreadyUnlocked = new Set(existingAchievements.map((a) => a.achievementId));
    const newlyUnlocked: string[] = [];

    const bestStreak = Math.max(profile.currentStreak, profile.longestStreak);

    for (const achievement of ACHIEVEMENTS) {
      if (alreadyUnlocked.has(achievement.id)) continue;

      let earned = false;

      switch (achievement.category) {
        case 'streak':
          earned = bestStreak >= achievement.threshold;
          break;
        case 'volume':
          earned = profile.totalStudyMinutes >= achievement.threshold;
          break;
        case 'sessions':
          earned = sessionCount >= achievement.threshold;
          break;
        case 'proof':
          earned = verifiedCount >= achievement.threshold;
          break;
        case 'level':
          earned = profile.level >= achievement.threshold;
          break;
        // social achievements are checked elsewhere (league join/create)
      }

      if (earned) {
        newlyUnlocked.push(achievement.id);
      }
    }

    if (newlyUnlocked.length > 0) {
      await this.prisma.userAchievement.createMany({
        data: newlyUnlocked.map((achievementId) => ({
          userId,
          achievementId,
        })),
        skipDuplicates: true,
      });
    }

    return newlyUnlocked;
  }

  /**
   * Check social achievements (league join/create).
   */
  async checkSocialAchievement(
    userId: string,
    type: 'league_join' | 'league_create',
  ): Promise<string[]> {
    const existing = await this.prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId: type } },
    });

    if (existing) return [];

    // Verify the achievement definition exists
    const achievement = await this.prisma.achievement.findUnique({
      where: { id: type },
    });

    if (!achievement) return [];

    await this.prisma.userAchievement.create({
      data: { userId, achievementId: type },
    });

    return [type];
  }
}
