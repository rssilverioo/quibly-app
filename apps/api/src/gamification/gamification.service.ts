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

    // Update streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastStudy = profile.lastStudyDate
      ? new Date(profile.lastStudyDate)
      : null;

    let newStreak = profile.currentStreak;
    if (lastStudy) {
      lastStudy.setHours(0, 0, 0, 0);
      const diffDays = Math.floor(
        (today.getTime() - lastStudy.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const updatedProfile = await this.prisma.profile.update({
      where: { id: userId },
      data: {
        totalXp: newTotalXp,
        level: newLevel,
        currentStreak: newStreak,
        longestStreak: Math.max(profile.longestStreak, newStreak),
        lastStudyDate: today,
      },
    });

    return {
      xp_awarded: xpAmount,
      total_xp: updatedProfile.totalXp,
      previous_level: previousLevel,
      new_level: newLevel,
      level_up: newLevel > previousLevel,
      current_streak: updatedProfile.currentStreak,
    };
  }
}
