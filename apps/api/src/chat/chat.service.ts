import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { transformKeys } from '../common/interceptors/snake-case.interceptor';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: ChatGateway,
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

    /**
     * O texto de uma mensagem apagada **não sai daqui**.
     *
     * Guardar para moderação e devolver para a sala são coisas diferentes: se o
     * conteúdo continuasse viajando, apagar não teria efeito nenhum para quem
     * abrisse a conversa depois. O cliente recebe `deleted_at` e desenha a
     * lápide sozinho.
     */
    return {
      messages: result.map((mensagem) =>
        mensagem.deletedAt ? { ...mensagem, content: '' } : mensagem,
      ),
      hasMore,
    };
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

    /**
     * A sala recebe agora, não no próximo ciclo de busca.
     *
     * Emitido **depois** da escrita e com o objeto do banco, para que todo mundo
     * veja a mesma mensagem com o mesmo `id` — é esse id que reconcilia a bolha
     * otimista que o autor já está vendo desde antes da ida ao servidor.
     *
     * `transformKeys` porque o socket não passa pelo interceptor de HTTP: sem
     * ele, a mesma mensagem chegaria em dois formatos de chave conforme o
     * caminho.
     */
    this.gateway.anunciarMensagem(leagueId, transformKeys(message));

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
      // `leagueId` entra porque o anúncio da lápide precisa saber para que sala
      // emitir — a rota só recebe o id da mensagem.
      select: { id: true, userId: true, leagueId: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    /**
     * Marca, não remove.
     *
     * O `delete` que havia aqui levava a prova junto com a mensagem: depois
     * dele não restava sequer o registro de que algo tinha sido dito. Ofensa
     * apagada pelo próprio autor virava ofensa que nunca existiu.
     *
     * A conversa passa a mostrar uma lápide ("mensagem apagada") em vez de um
     * buraco, o que também é mais honesto para quem leu antes.
     */
    await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    // A lápide aparece na hora para quem está com a sala aberta. Sem isto ela
    // só surgiria na próxima vez que alguém reabrisse a conversa.
    this.gateway.anunciarApagada(message.leagueId, messageId);

    return { deleted: true };
  }

  /**
   * Esvazia o conteúdo de mensagens apagadas que passaram do prazo.
   *
   * **Autor, data e hora não são tocados.** É essa assimetria que faz o
   * conjunto funcionar: enquanto o prazo corre, a moderação tem o texto para
   * julgar um abuso; vencido o prazo, o texto do usuário deixa de ser guardado
   * e sobra só o rastro de que houve uma mensagem, de quem e quando.
   *
   * Só mexe em quem tem `deletedAt` — mensagem viva nunca é expurgada por
   * idade. Retenção de conversa ativa é outra política, e não se decide dentro
   * de uma varredura.
   */
  async purgarConteudoVencido(diasDeRetencao: number, agora = new Date()) {
    const limite = new Date(agora);
    limite.setDate(limite.getDate() - diasDeRetencao);

    const { count } = await this.prisma.chatMessage.updateMany({
      where: {
        deletedAt: { not: null, lt: limite },
        // Sem isto a varredura reescreveria as mesmas linhas todo dia, e
        // `purgedAt` passaria a mentir sobre quando o expurgo aconteceu.
        purgedAt: null,
      },
      data: { content: '', purgedAt: agora },
    });

    return { purgadas: count };
  }
}
