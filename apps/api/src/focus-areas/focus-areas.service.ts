import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';

export interface FocusArea {
  id: string;
  topic: string;
  status: 'weak' | 'learning' | 'mastered';
  score: number; // 0-100
  source: 'auto' | 'manual';
  note?: string;
}

@Injectable()
export class FocusAreasService {
  private readonly logger = new Logger(FocusAreasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: GeminiService,
  ) {}

  async getFocusAreas(userId: string): Promise<FocusArea[]> {
    const areas: FocusArea[] = [];

    // 1. Auto-detect from quiz scores
    const quizzes = await this.prisma.quiz.findMany({
      where: { userId, score: { not: null } },
      select: { id: true, title: true, score: true, totalQ: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    for (const quiz of quizzes) {
      if (quiz.score === null || quiz.totalQ === 0) continue;
      const pct = Math.round((quiz.score / quiz.totalQ) * 100);
      const status = pct >= 80 ? 'mastered' : pct >= 50 ? 'learning' : 'weak';
      areas.push({
        id: `quiz-${quiz.id}`,
        topic: quiz.title,
        status,
        score: pct,
        source: 'auto',
      });
    }

    // 2. Manual focus areas (stored in profile or separate table — use JSON in profile for MVP)
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { subjects: { select: { name: true } } },
    });

    // Sort: weak first, then learning, then mastered
    const order = { weak: 0, learning: 1, mastered: 2 };
    areas.sort((a, b) => order[a.status] - order[b.status]);

    return areas.slice(0, 10);
  }

  async generateStudyNote(userId: string, topic: string): Promise<{ note: string; tips: string[] }> {
    const prompt = `You are a friendly tutor. A student is struggling with "${topic}".

Create a concise study note that:
1. Explains the core concept simply (like to a teenager)
2. Gives 1-2 real-world examples or analogies
3. Lists 3 key points to remember

Also provide 3 actionable study tips specific to this topic.

Return JSON: { "note": "...", "tips": ["...", "...", "..."] }`;

    return this.ai.chatJSON<{ note: string; tips: string[] }>(prompt);
  }

  async addManualFocus(userId: string, topic: string): Promise<FocusArea> {
    // Generate a study note for the topic
    const { note } = await this.generateStudyNote(userId, topic);

    return {
      id: `manual-${Date.now()}`,
      topic,
      status: 'weak',
      score: 0,
      source: 'manual',
      note,
    };
  }
}
