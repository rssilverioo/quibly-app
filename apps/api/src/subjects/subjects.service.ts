import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSubjectDto) {
    return this.prisma.subject.create({
      data: {
        userId,
        name: dto.name,
        color: dto.color,
        icon: dto.icon ?? null,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.subject.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, userId },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return subject;
  }

  async update(id: string, userId: string, dto: UpdateSubjectDto) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, userId },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return this.prisma.subject.update({
      where: { id },
      data: { ...dto },
    });
  }

  async delete(id: string, userId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, userId },
    });

    if (!subject) {
      throw new NotFoundException(
        'Subject not found or is referenced by existing sessions',
      );
    }

    try {
      return await this.prisma.subject.delete({ where: { id } });
    } catch {
      throw new NotFoundException(
        'Subject not found or is referenced by existing sessions',
      );
    }
  }
}
