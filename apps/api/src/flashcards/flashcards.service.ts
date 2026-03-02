import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FlashcardsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.flashcardSet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { flashcards: true } },
      },
    });
  }

  async get(userId: string, id: string) {
    const set = await this.prisma.flashcardSet.findUnique({
      where: { id },
      include: {
        flashcards: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!set) throw new NotFoundException('Flashcard set not found');
    if (set.userId !== userId) throw new ForbiddenException();

    return set;
  }

  async delete(userId: string, id: string) {
    const set = await this.prisma.flashcardSet.findUnique({ where: { id } });
    if (!set) throw new NotFoundException('Flashcard set not found');
    if (set.userId !== userId) throw new ForbiddenException();

    await this.prisma.flashcardSet.delete({ where: { id } });
    return { deleted: true };
  }
}
