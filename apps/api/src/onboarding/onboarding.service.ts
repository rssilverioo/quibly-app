import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteOnboardingDto } from './onboarding.dto';

const SUBJECT_COLORS = [
  '#7C5CFC', '#00D4AA', '#FF6B6B', '#FFB84D', '#4ECDC4',
  '#FF6F91', '#957FEF', '#08D9D6', '#FF9671', '#00C9A7',
  '#FFC75F', '#845EC2', '#D65DB1', '#0089BA', '#F9F871',
];

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async complete(userId: string, dto: CompleteOnboardingDto) {
    // Update profile with onboarding data
    const profile = await this.prisma.profile.update({
      where: { id: userId },
      data: {
        username: dto.username || undefined,
        educationLevel: dto.education_level,
        studyGoal: dto.study_goal,
        dailyGoalMinutes: dto.daily_goal_minutes,
        onboardingCompleted: true,
      },
    });

    // Create subjects from selected list
    if (dto.subjects.length > 0) {
      const existing = await this.prisma.subject.findMany({
        where: { userId },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));

      const newSubjects = dto.subjects
        .filter((name) => !existingNames.has(name.toLowerCase()))
        .map((name, i) => ({
          userId,
          name,
          color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
        }));

      if (newSubjects.length > 0) {
        await this.prisma.subject.createMany({ data: newSubjects });
      }
    }

    this.logger.log(`Onboarding completed for user ${userId}: ${dto.education_level}, ${dto.study_goal}, ${dto.daily_goal_minutes}min, ${dto.subjects.length} subjects`);

    return profile;
  }
}
