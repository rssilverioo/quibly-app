import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private chatDebounce = new Map<string, number>();
  private readonly CHAT_DEBOUNCE_MS = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async registerToken(userId: string, token: string, platform?: string) {
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, updatedAt: new Date() },
      create: { userId, token, platform },
    });
    return { registered: true };
  }

  async unregisterToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({
      where: { userId, token },
    });
    return { unregistered: true };
  }

  private async getTokensForUser(userId: string): Promise<string[]> {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    return tokens.map((t) => t.token);
  }

  private async sendToTokens(
    tokens: string[],
    notification: { title: string; body: string },
    data?: Record<string, string>,
    channelId?: string,
  ) {
    if (tokens.length === 0) return;

    const messaging = this.firebaseService.getMessaging();

    const sendPromises = tokens.map((token) =>
      messaging
        .send({
          token,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: data ?? {},
          android: {
            notification: {
              channelId: channelId ?? 'social',
            },
          },
        })
        .catch((err) => {
          const code = err?.code || err?.errorInfo?.code || '';
          const msg = err?.message || '';
          const isInvalid =
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/invalid-argument' ||
            msg.includes('not a valid FCM registration token') ||
            msg.includes('not registered');

          if (isInvalid) {
            this.logger.log(`Removing invalid push token: ${token.slice(0, 20)}...`);
            this.prisma.pushToken
              .deleteMany({ where: { token } })
              .catch(() => {});
          } else {
            this.logger.warn(`Push send failed (code=${code}): ${msg}`);
          }
        }),
    );

    await Promise.allSettled(sendPromises);
  }

  async notifyFeedReaction(
    postOwnerId: string,
    reactorUserId: string,
    reactorName: string,
    emoji: string,
  ) {
    if (postOwnerId === reactorUserId) return;

    const tokens = await this.getTokensForUser(postOwnerId);
    if (tokens.length === 0) return;

    await this.sendToTokens(
      tokens,
      {
        title: 'New Reaction',
        body: `${reactorName} reacted ${emoji} to your post`,
      },
      { type: 'feed_reaction' },
    );
  }

  async notifyFeedComment(
    postOwnerId: string,
    commenterUserId: string,
    commenterName: string,
    commentPreview: string,
  ) {
    if (postOwnerId === commenterUserId) return;

    const tokens = await this.getTokensForUser(postOwnerId);
    if (tokens.length === 0) return;

    const preview =
      commentPreview.length > 50
        ? commentPreview.slice(0, 50) + '...'
        : commentPreview;

    await this.sendToTokens(
      tokens,
      {
        title: 'New Comment',
        body: `${commenterName}: ${preview}`,
      },
      { type: 'feed_comment' },
    );
  }

  async notifyChatMessage(
    leagueId: string,
    senderId: string,
    senderName: string,
    content: string,
  ) {
    const members = await this.prisma.leagueMember.findMany({
      where: { leagueId, NOT: { userId: senderId } },
      select: { userId: true },
    });

    if (members.length === 0) return;

    const now = Date.now();
    const recipientIds = members
      .map((m) => m.userId)
      .filter((userId) => {
        const key = `${leagueId}:${userId}`;
        const lastSent = this.chatDebounce.get(key) ?? 0;
        if (now - lastSent < this.CHAT_DEBOUNCE_MS) return false;
        this.chatDebounce.set(key, now);
        return true;
      });

    if (recipientIds.length === 0) return;

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: recipientIds } },
      select: { token: true },
    });

    if (tokens.length === 0) return;

    const preview =
      content.length > 80 ? content.slice(0, 80) + '...' : content;

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { name: true },
    });

    await this.sendToTokens(
      tokens.map((t) => t.token),
      {
        title: league?.name ?? 'New Message',
        body: `${senderName}: ${preview}`,
      },
      { type: 'chat_message', leagueId },
    );
  }

  async notifyAchievements(userId: string, achievementNames: string[]) {
    if (achievementNames.length === 0) return;

    const tokens = await this.getTokensForUser(userId);
    if (tokens.length === 0) return;

    const names = achievementNames.join(', ');

    await this.sendToTokens(
      tokens,
      {
        title: 'Achievement Unlocked!',
        body: names,
      },
      { type: 'achievement' },
    );
  }

  async broadcastToSegment(
    title: string,
    body: string,
    segment: 'all' | 'pro' | 'free',
  ): Promise<{ sent: number }> {
    const where: any = {};

    if (segment === 'pro') {
      where.user = { plan: 'PRO' };
    } else if (segment === 'free') {
      where.user = { plan: 'FREE' };
    }

    const pushTokens = await this.prisma.pushToken.findMany({
      where,
      select: { token: true },
    });

    if (pushTokens.length === 0) return { sent: 0 };

    const allTokens = pushTokens.map((t) => t.token);
    const BATCH_SIZE = 500;

    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
      const batch = allTokens.slice(i, i + BATCH_SIZE);
      await this.sendToTokens(
        batch,
        { title, body },
        { type: 'broadcast' },
      );
    }

    return { sent: allTokens.length };
  }
}
