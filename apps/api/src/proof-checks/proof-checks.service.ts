import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PROOF_CHECK } from '@quibly/shared';

@Injectable()
export class ProofChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async triggerCheck(userId: string, sessionId: string) {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not own this session');
    }

    if (session.status !== 'active') {
      throw new BadRequestException('Session is not active');
    }

    if (!session.proofMode) {
      throw new BadRequestException('Proof mode is not enabled for this session');
    }

    const now = new Date();
    const deadlineAt = new Date(
      now.getTime() + PROOF_CHECK.RESPONSE_DEADLINE_SECONDS * 1000,
    );

    return this.prisma.proofCheck.create({
      data: {
        sessionId,
        userId,
        triggeredAt: now,
        deadlineAt,
        status: 'pending',
      },
    });
  }

  async getPendingChecks(userId: string, sessionId: string) {
    return this.prisma.proofCheck.findMany({
      where: {
        sessionId,
        userId,
        status: 'pending',
        triggeredAt: { lte: new Date() },
      },
    });
  }

  async submitProof(
    userId: string,
    proofCheckId: string,
    file: Express.Multer.File,
  ) {
    const proofCheck = await this.prisma.proofCheck.findUnique({
      where: { id: proofCheckId },
    });

    if (!proofCheck) {
      throw new NotFoundException('Proof check not found');
    }

    if (proofCheck.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to submit this proof check',
      );
    }

    if (proofCheck.status !== 'pending') {
      throw new BadRequestException('Proof check is no longer pending');
    }

    if (proofCheck.deadlineAt <= new Date()) {
      throw new BadRequestException('Proof check deadline has passed');
    }

    const filePath = `proof-photos/${userId}/${proofCheck.sessionId}/${proofCheckId}.jpg`;
    const signedUrl = await this.storageService.uploadPrivate(
      filePath,
      file.buffer,
      file.mimetype,
    );

    return this.prisma.proofCheck.update({
      where: { id: proofCheckId },
      data: {
        status: 'passed',
        respondedAt: new Date(),
        photoUrl: signedUrl,
      },
    });
  }

  async failCheck(proofCheckId: string) {
    const proofCheck = await this.prisma.proofCheck.findUnique({
      where: { id: proofCheckId },
    });

    if (!proofCheck) {
      throw new NotFoundException('Proof check not found');
    }

    if (
      proofCheck.status !== 'pending' ||
      proofCheck.deadlineAt > new Date()
    ) {
      return proofCheck;
    }

    return this.prisma.proofCheck.update({
      where: { id: proofCheckId },
      data: { status: 'missed' },
    });
  }

  async getSessionChecks(sessionId: string, userId: string) {
    return this.prisma.proofCheck.findMany({
      where: { sessionId, userId },
      orderBy: { triggeredAt: 'asc' },
    });
  }

  async checkExpiredProofs() {
    const now = new Date();

    const expiredChecks = await this.prisma.proofCheck.findMany({
      where: {
        status: 'pending',
        deadlineAt: { lt: now },
      },
    });

    if (expiredChecks.length === 0) {
      return { expiredCount: 0 };
    }

    const expiredIds = expiredChecks.map((check) => check.id);

    await this.prisma.proofCheck.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: 'missed' },
    });

    const sessionIds = [
      ...new Set(expiredChecks.map((check) => check.sessionId)),
    ];

    await this.prisma.studySession.updateMany({
      where: { id: { in: sessionIds } },
      data: { isVerified: false },
    });

    return { expiredCount: expiredChecks.length };
  }
}
