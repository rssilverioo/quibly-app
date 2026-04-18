import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateService } from '../generate/generate.service';
import { CompleteOnboardingDto } from './onboarding.dto';

const SUBJECT_COLORS = [
  '#7C5CFC', '#00D4AA', '#FF6B6B', '#FFB84D', '#4ECDC4',
  '#FF6F91', '#957FEF', '#08D9D6', '#FF9671', '#00C9A7',
  '#FFC75F', '#845EC2', '#D65DB1', '#0089BA', '#F9F871',
];

const MAX_AUTO_GENERATE = 3;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generateService: GenerateService,
  ) {}

  async complete(userId: string, dto: CompleteOnboardingDto) {
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

    // Auto-generate initial study content (async — don't block response)
    const subjectsToGenerate = dto.subjects.slice(0, MAX_AUTO_GENERATE);
    if (subjectsToGenerate.length > 0) {
      this.generateInitialContent(userId, subjectsToGenerate).catch((err) =>
        this.logger.error(`Failed to generate initial content: ${err?.message}`),
      );
    }

    return profile;
  }

  private async generateInitialContent(userId: string, subjects: string[]) {
    this.logger.log(`Generating initial content for ${userId}: ${subjects.join(', ')}`);

    for (const subject of subjects) {
      try {
        // Generate flashcards
        await this.generateService.generateFromTopic(userId, subject, 'flashcards');
        this.logger.log(`Generated flashcards for "${subject}"`);
      } catch (err: any) {
        this.logger.warn(`Failed to generate flashcards for "${subject}": ${err?.message}`);
      }

      try {
        // Generate quiz
        await this.generateService.generateFromTopic(userId, subject, 'quiz');
        this.logger.log(`Generated quiz for "${subject}"`);
      } catch (err: any) {
        this.logger.warn(`Failed to generate quiz for "${subject}": ${err?.message}`);
      }
    }

    this.logger.log(`Initial content generation complete for ${userId}`);
  }
}
