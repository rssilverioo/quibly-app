import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { idiomaDe, textosPara } from './notification-texts';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private chatDebounce = new Map<string, number>();
  private readonly CHAT_DEBOUNCE_MS = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * O `locale` é o do **aparelho**, e chega em toda re-registro.
   *
   * Isso importa: quem troca o idioma do celular passa a receber no novo sem
   * fazer mais nada, porque o app re-registra o token a cada abertura. Se ele
   * fosse gravado só na criação, a pessoa ficaria presa ao idioma que o
   * aparelho tinha no dia em que instalou o app.
   */
  async registerToken(
    userId: string,
    token: string,
    platform?: string,
    locale?: string,
  ) {
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, locale, updatedAt: new Date() },
      create: { userId, token, platform, locale },
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

  /**
   * Os aparelhos de quem vai receber, agrupados pelo idioma de cada um.
   *
   * Agrupar em vez de mandar um por um: cada grupo compõe o texto uma vez e
   * dispara para todos os tokens daquele idioma. Uma pessoa com o celular em
   * português e o tablet em inglês recebe cada um no seu, sem que nada além
   * desta função saiba que isso é possível.
   */
  private async tokensPorIdioma(
    userIds: string[],
  ): Promise<Map<'pt' | 'en', string[]>> {
    const linhas = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true, locale: true },
    });

    const grupos = new Map<'pt' | 'en', string[]>();
    for (const linha of linhas) {
      const idioma = idiomaDe(linha.locale);
      const lista = grupos.get(idioma) ?? [];
      lista.push(linha.token);
      grupos.set(idioma, lista);
    }
    return grupos;
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
          } else if (code === 'messaging/third-party-auth-error') {
            /*
             O Firebase não conseguiu falar com a Apple.

             Este código quer dizer uma coisa só, e nunca é culpa do token: a
             chave APNs do projeto está ausente, vencida, ou é de outro time.
             O aparelho está certo, o token está certo, e nada chega.

             Merece mensagem própria porque, num `warn` genérico, ele se perde
             entre falhas de rede — e a ação é completamente diferente: não é
             tentar de novo, é subir a `.p8` no console do Firebase.
            */
            this.logger.error(
              'APNs auth failed: check the APNs key in Firebase Console → Cloud Messaging ' +
                `(project settings, iOS app). Nothing will reach iPhones until it is fixed. ${msg}`,
            );
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

    const preview =
      content.length > 80 ? content.slice(0, 80) + '...' : content;

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { name: true },
    });

    // O nome da sala vem do que a pessoa digitou, então ele não se traduz — o
    // que precisa de idioma é a saída para quando a sala não tem nome.
    const grupos = await this.tokensPorIdioma(recipientIds);
    for (const [idioma, tokens] of grupos) {
      const texto = textosPara(idioma);
      await this.sendToTokens(
        tokens,
        {
          title: texto.chatTitulo(league?.name ?? texto.salaSemNome),
          body: texto.chatCorpo(senderName, preview),
        },
        { type: 'chat_message', leagueId },
      );
    }
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
