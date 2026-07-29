import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';

interface DailyTask {
  id: string;
  type: 'review_cards' | 'take_quiz' | 'generate_topic' | 'pomodoro' | 'upload';
  title: string;
  description: string;
  completed: boolean;
  params?: Record<string, string>;
}

@Injectable()
export class DailyPlanService {
  private readonly logger = new Logger(DailyPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: GeminiService,
  ) {}

  async getPlan(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check cache
    const existing = await this.prisma.dailyPlan.findUnique({
      where: { userId_date: { userId, date: today } },
    });
    if (existing) return existing;

    // Generate new plan
    const tasks = await this.generateTasks(userId);

    const plan = await this.prisma.dailyPlan.create({
      data: {
        userId,
        date: today,
        tasks: tasks as any,
      },
    });

    this.logger.log(`Generated daily plan for ${userId}: ${tasks.length} tasks`);
    return plan;
  }

  async completeTask(userId: string, taskId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const plan = await this.prisma.dailyPlan.findUnique({
      where: { userId_date: { userId, date: today } },
    });
    if (!plan) return null;

    const tasks = (plan.tasks as unknown as DailyTask[]).map((t) =>
      t.id === taskId ? { ...t, completed: true } : t,
    );

    return this.prisma.dailyPlan.update({
      where: { id: plan.id },
      data: { tasks: tasks as any },
    });
  }

  private async generateTasks(userId: string): Promise<DailyTask[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: {
        dailyGoalMinutes: true,
        educationLevel: true,
        studyGoal: true,
        subjects: { select: { id: true, name: true } },
        flashcardSets: {
          select: { id: true, title: true, _count: { select: { flashcards: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        quizzes: {
          select: { id: true, title: true, score: true, totalQ: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!profile) return this.fallbackTasks();

    const subjects = profile.subjects.map((s) => s.name);
    const hasCards = profile.flashcardSets.length > 0;
    const hasQuizzes = profile.quizzes.length > 0;
    const minutes = profile.dailyGoalMinutes || 15;

    // If no content yet, suggest creation tasks
    if (!hasCards && !hasQuizzes) {
      return this.newUserTasks(subjects, minutes);
    }

    // Use AI to generate personalized plan
    try {
      return await this.aiGeneratedTasks(profile, subjects, minutes);
    } catch (err) {
      this.logger.warn(`AI plan generation failed, using fallback: ${err}`);
      return this.ruleBasedTasks(profile, subjects, minutes);
    }
  }

  private async aiGeneratedTasks(
    profile: any,
    subjects: string[],
    minutes: number,
  ): Promise<DailyTask[]> {
    const cardsSummary = profile.flashcardSets
      .map((s: any) => `"${s.title}" (${s._count.flashcards} cards)`)
      .join(', ');

    const quizSummary = profile.quizzes
      .map((q: any) => `"${q.title}" (score: ${q.score ?? 'not attempted'}/${q.totalQ})`)
      .join(', ');

    const prompt = `You are a study coach creating a daily study plan for a student.

Student info:
- Education: ${profile.educationLevel || 'unknown'}
- Goal: ${profile.studyGoal || 'general learning'}
- Subjects: ${subjects.join(', ') || 'none specified'}
- Daily time: ${minutes} minutes
- Existing flashcard sets: ${cardsSummary || 'none'}
- Existing quizzes: ${quizSummary || 'none'}

Create ${minutes <= 15 ? '3' : minutes <= 30 ? '4' : '5'} study tasks for today. Each task should be actionable and specific.

Task types available:
- "review_cards": Review flashcards from an existing set. Include flashcardSetId and flashcardSetTitle in params.
- "take_quiz": Take a quiz. Include quizId and quizTitle in params.
- "generate_topic": Generate new flashcards/quiz on a specific topic from their subjects.
- "pomodoro": Do a focused study session.

Rules:
- Prioritize reviewing content where quiz scores were low
- Mix review with new content generation
- Match total time to ${minutes} minutes
- Use the student's actual subjects and existing content
- Each task gets a fun, motivating title and short description

Return JSON: { "tasks": [ { "id": "1", "type": "...", "title": "...", "description": "...", "completed": false, "params": { ... } } ] }`;

    const result = await this.ai.chatJSON<{ tasks: DailyTask[] }>(prompt);
    return (result.tasks || []).map((t, i) => ({ ...t, id: String(i + 1), completed: false }));
  }

  private ruleBasedTasks(profile: any, subjects: string[], minutes: number): DailyTask[] {
    const tasks: DailyTask[] = [];
    let id = 1;

    // Review weakest quiz
    const weakQuiz = profile.quizzes.find((q: any) => q.score !== null && q.score < q.totalQ * 0.7);
    if (weakQuiz) {
      tasks.push({
        id: String(id++),
        type: 'take_quiz',
        title: `Retry: ${weakQuiz.title}`,
        description: 'Improve your score on this quiz',
        completed: false,
        params: { quizId: weakQuiz.id, quizTitle: weakQuiz.title },
      });
    }

    // Review cards
    if (profile.flashcardSets.length > 0) {
      const set = profile.flashcardSets[0];
      tasks.push({
        id: String(id++),
        type: 'review_cards',
        title: `Review: ${set.title}`,
        description: `Go through ${set._count.flashcards} flashcards`,
        completed: false,
        params: { flashcardSetId: set.id, flashcardSetTitle: set.title },
      });
    }

    // Generate new content
    if (subjects.length > 0) {
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      tasks.push({
        id: String(id++),
        type: 'generate_topic',
        title: `New cards: ${subject}`,
        description: `Generate flashcards about ${subject}`,
        completed: false,
        params: { topic: subject },
      });
    }

    // Pomodoro
    tasks.push({
      id: String(id),
      type: 'pomodoro',
      title: 'Focus session',
      description: `${Math.min(minutes, 25)} min focused study`,
      completed: false,
    });

    return tasks;
  }

  private newUserTasks(subjects: string[], _minutes: number): DailyTask[] {
    const tasks: DailyTask[] = [];
    let id = 1;

    if (subjects.length > 0) {
      tasks.push({
        id: String(id++),
        type: 'generate_topic',
        title: `Create cards: ${subjects[0]}`,
        description: `Generate your first flashcards about ${subjects[0]}`,
        completed: false,
        params: { topic: subjects[0] },
      });
    }

    tasks.push({
      id: String(id++),
      type: 'upload',
      title: 'Upload a document',
      description: 'Turn any PDF into flashcards & quizzes',
      completed: false,
    });

    tasks.push({
      id: String(id),
      type: 'pomodoro',
      title: 'First study session',
      description: 'Start a 25-minute focus session',
      completed: false,
    });

    return tasks;
  }

  private fallbackTasks(): DailyTask[] {
    return [
      { id: '1', type: 'upload', title: 'Upload a document', description: 'Turn any PDF into study material', completed: false },
      { id: '2', type: 'pomodoro', title: 'Study session', description: '25 min focused study', completed: false },
    ];
  }
}
