import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeminiService } from '../gemini/gemini.service';
import { v4 as uuid } from 'uuid';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly geminiService: GeminiService,
  ) {}

  async upload(
    userId: string,
    file: Express.Multer.File,
    title: string,
    subject?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');

    const key = `documents/${userId}/${uuid()}-${file.originalname}`;
    await this.storageService.uploadPrivate(key, file.buffer, file.mimetype);

    let extractedText: string | null = null;
    let pageCount: number | null = null;

    if (file.mimetype === 'application/pdf') {
      try {
        const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
        const textResult = await parser.getText();
        extractedText = textResult.text;
        pageCount = textResult.pages?.length ?? null;
        await parser.destroy();
      } catch (err) {
        this.logger.warn(`PDF parse failed, trying OCR fallback: ${err}`);
      }
    }

    // OCR fallback for images or failed PDF parse
    if (!extractedText && file.buffer.length > 0) {
      try {
        extractedText = await this.geminiService.extractTextFromImage(file.buffer);
      } catch (err) {
        this.logger.warn(`OCR fallback failed: ${err}`);
      }
    }

    return this.prisma.document.create({
      data: {
        userId,
        title,
        subject,
        s3Key: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        extractedText,
        pageCount,
      },
    });
  }

  async list(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { flashcardSets: true, quizzes: true },
        },
      },
    });
  }

  async get(userId: string, id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        flashcardSets: {
          include: { _count: { select: { flashcards: true } } },
          orderBy: { createdAt: 'desc' },
        },
        quizzes: {
          include: { _count: { select: { questions: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!doc) throw new NotFoundException('Document not found');
    if (doc.userId !== userId) throw new ForbiddenException();

    return doc;
  }

  async delete(userId: string, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.userId !== userId) throw new ForbiddenException();

    await this.storageService.deleteObject(doc.s3Key);
    await this.prisma.document.delete({ where: { id } });

    return { deleted: true };
  }
}
