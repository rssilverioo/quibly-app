import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XP_REWARDS, levelFromXp } from '@quibly/shared';

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async awardXp(userId: string, action: keyof typeof XP_REWARDS) {
    const xpAmount = XP_REWARDS[action];

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) throw new NotFoundException('Profile not found');

    const newTotalXp = profile.totalXp + xpAmount;
    const previousLevel = profile.level;
    const newLevel = levelFromXp(newTotalXp);

    // Streak is managed exclusively by sessions.service.ts:updateUserStreak()
    // which validates minimum daily study minutes before counting a day.

    const updatedProfile = await this.prisma.profile.update({
      where: { id: userId },
      data: {
        totalXp: newTotalXp,
        level: newLevel,
      },
    });

    return {
      xp_awarded: xpAmount,
      total_xp: updatedProfile.totalXp,
      previous_level: previousLevel,
      new_level: newLevel,
      level_up: newLevel > previousLevel,
      current_streak: profile.currentStreak,
    };
  }
}
