import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async verifyMembership(
    leagueId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this league');
    }
  }

  async getMessages(
    leagueId: string,
    userId: string,
    cursor?: string,
    limit: number = 50,
  ) {
    await this.verifyMembership(leagueId, userId);

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        leagueId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: {
        user: {
          select: { username: true, handle: true, avatarUrl: true },
        },
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const result = hasMore ? messages.slice(0, limit) : messages;

    return { messages: result, hasMore };
  }

  async sendMessage(userId: string, leagueId: string, content: string) {
    await this.verifyMembership(leagueId, userId);

    const message = await this.prisma.chatMessage.create({
      data: {
        userId,
        leagueId,
        content,
        messageType: 'text',
      },
      include: {
        user: {
          select: { username: true, handle: true, avatarUrl: true },
        },
      },
    });

    // Send push notification to league members (debounced)
    this.notificationsService
      .notifyChatMessage(
        leagueId,
        userId,
        message.user?.username ?? 'Someone',
        content,
      )
      .catch(() => {});

    return message;
  }

  async sendSystemMessage(leagueId: string, content: string) {
    return this.prisma.chatMessage.create({
      data: {
        userId: null,
        leagueId,
        content,
        messageType: 'system',
      },
    });
  }

  async toggleReaction(userId: string, messageId: string, emoji: string) {
    const existing = await this.prisma.chatReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await this.prisma.chatReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.chatReaction.create({
        data: { messageId, userId, emoji },
      });
    }

    return this.prisma.chatReaction.findMany({
      where: { messageId },
    });
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, userId: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.chatMessage.delete({ where: { id: messageId } });

    return { deleted: true };
  }
}
