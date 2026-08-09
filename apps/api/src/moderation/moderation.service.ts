import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AUTOR_COM_ID } from '../common/autor.select';

/** O que se pode denunciar. Mais que isto vira campo livre e não vira fila. */
export const TIPOS_DENUNCIAVEIS = ['post', 'comment', 'chat_message', 'profile'] as const;
export type TipoDenunciavel = (typeof TIPOS_DENUNCIAVEIS)[number];

export const MOTIVOS = ['spam', 'harassment', 'nudity', 'violence', 'other'] as const;
export type Motivo = (typeof MOTIVOS)[number];

/**
 * Bloquear e denunciar.
 *
 * Existe porque a Apple exige os dois em qualquer app com conteúdo de usuário
 * (Guideline 1.2) — e o app tem feed e chat. Mas a exigência é o piso; o que
 * está desenhado aqui é o produto.
 */
@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Quem esta pessoa não quer mais ver.
   *
   * É a leitura quente do módulo: acontece a cada carga de feed e de chat, e
   * por isso devolve um `Set` de ids, e não linhas. Quem chama filtra em
   * memória — a alternativa seria um `NOT IN (subquery)` em cada consulta de
   * conteúdo, espalhando a regra por todo lugar onde alguém lê alguma coisa.
   */
  async bloqueadosPor(userId: string): Promise<Set<string>> {
    const linhas = await this.prisma.userBlock.findMany({
      where: { userId },
      select: { blockedId: true },
    });
    return new Set(linhas.map((l) => l.blockedId));
  }

  /**
   * Bloqueia, e não avisa ninguém.
   *
   * Notificar quem foi bloqueado transformaria a proteção em confronto — é
   * exatamente a situação de que a pessoa está tentando sair. Nenhuma rota
   * expõe "quem me bloqueou", pelo mesmo motivo.
   */
  async bloquear(userId: string, blockedId: string) {
    if (userId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const existe = await this.prisma.profile.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('User not found');

    // `upsert` e não `create`: bloquear duas vezes é a mesma decisão, e a
    // segunda não pode responder erro para quem já conseguiu o que queria.
    await this.prisma.userBlock.upsert({
      where: { userId_blockedId: { userId, blockedId } },
      create: { userId, blockedId },
      update: {},
    });

    return { blocked: true };
  }

  async desbloquear(userId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({ where: { userId, blockedId } });
    return { blocked: false };
  }

  /** Quem eu bloqueei, para a tela de gerenciar. */
  async listarBloqueados(userId: string) {
    const linhas = await this.prisma.userBlock.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        blocked: { select: AUTOR_COM_ID },
      },
    });

    return linhas.map((l) => ({
      id: l.blocked.id,
      username: l.blocked.username,
      handle: l.blocked.handle,
      avatar_url: l.blocked.avatarUrl,
      blocked_at: l.createdAt,
    }));
  }

  /**
   * Registra a denúncia. **Não apaga nada.**
   *
   * Um `POST` de qualquer pessoa derrubando conteúdo alheio seria a ferramenta
   * de abuso mais fácil de usar que o produto teria: bastaria denunciar o
   * primeiro colocado do ranking. A linha entra em `PENDING` e quem decide é o
   * painel de admin.
   *
   * O que a pessoa ganha na hora é o bloqueio, que é imediato e não depende de
   * ninguém — e é por isso que a tela oferece os dois juntos.
   */
  async denunciar(
    reporterId: string,
    dados: { targetType: string; targetId: string; reason: string; details?: string },
  ) {
    if (!TIPOS_DENUNCIAVEIS.includes(dados.targetType as TipoDenunciavel)) {
      throw new BadRequestException('Unknown target type');
    }
    if (!MOTIVOS.includes(dados.reason as Motivo)) {
      throw new BadRequestException('Unknown reason');
    }

    const prova = await this.fotografar(dados.targetType, dados.targetId);

    await this.prisma.contentReport.upsert({
      where: {
        reporterId_targetType_targetId: {
          reporterId,
          targetType: dados.targetType,
          targetId: dados.targetId,
        },
      },
      create: {
        reporterId,
        targetType: dados.targetType,
        targetId: dados.targetId,
        reason: dados.reason,
        details: dados.details?.trim()?.slice(0, 500) || null,
        ...prova,
      },
      // Denunciar de novo não empilha na fila; atualiza o motivo. A prova
      // **não** é refotografada: a primeira é a do momento em que a pessoa se
      // sentiu ofendida, e é essa que interessa. Refazer permitiria "limpar" a
      // evidência editando o conteúdo e pedindo para ser denunciado de novo.
      update: { reason: dados.reason, details: dados.details?.trim()?.slice(0, 500) || null },
    });

    return { reported: true };
  }

  /**
   * A prova, no instante da denúncia.
   *
   * ## Por que copiar em vez de apontar
   *
   * A denúncia guardava só `targetId`. Quem foi denunciado apaga a mensagem em
   * dois toques, e a denúncia vira um ponteiro para o nada — quem fosse julgar
   * abriria o painel e não veria nada. Apagar viraria o caminho para escapar,
   * e é literalmente o que alguém denunciado faz.
   *
   * O conteúdo continua apagado para todo mundo no app. O que sobrevive é a
   * cópia, e só para quem for julgar.
   *
   * ## O que **não** é copiado
   *
   * A conversa em volta. Decisão do dono do produto em 09/08: o admin vê o que
   * foi denunciado e nada além disso. Salas são grupos privados, e a diferença
   * entre "temos moderação" e "lemos as conversas dos usuários" é essa linha.
   *
   * ## Por que falhar aqui não derruba a denúncia
   *
   * Sem prova a denúncia ainda vale — ela registra que alguém se incomodou, e
   * isso é informação. Recusar a denúncia porque a foto falhou seria perder as
   * duas coisas.
   */
  private async fotografar(tipo: string, alvo: string) {
    const vazio = {};
    try {
      if (tipo === 'chat_message') {
        const m = await this.prisma.chatMessage.findUnique({
          where: { id: alvo },
          select: {
            content: true,
            createdAt: true,
            leagueId: true,
            user: { select: { id: true, username: true } },
          },
        });
        if (!m) return vazio;
        return {
          snapshotText: m.content?.slice(0, 2000) ?? null,
          snapshotAuthorId: m.user?.id ?? null,
          snapshotAuthorName: m.user?.username ?? null,
          snapshotAt: m.createdAt,
          snapshotRoomId: m.leagueId,
        };
      }

      if (tipo === 'post' || tipo === 'comment') {
        const registro = tipo === 'post'
          ? await this.prisma.feedPost.findUnique({
              where: { id: alvo },
              select: {
                caption: true,
                createdAt: true,
                leagueId: true,
                user: { select: { id: true, username: true } },
              },
            })
          : await this.prisma.feedComment.findUnique({
              where: { id: alvo },
              select: {
                content: true,
                createdAt: true,
                post: { select: { leagueId: true } },
                user: { select: { id: true, username: true } },
              },
            });
        if (!registro) return vazio;
        const texto = 'caption' in registro ? registro.caption : registro.content;
        const sala = 'leagueId' in registro ? registro.leagueId : registro.post?.leagueId;
        return {
          snapshotText: texto?.slice(0, 2000) ?? null,
          snapshotAuthorId: registro.user?.id ?? null,
          snapshotAuthorName: registro.user?.username ?? null,
          snapshotAt: registro.createdAt,
          snapshotRoomId: sala ?? null,
        };
      }

      if (tipo === 'profile') {
        const p = await this.prisma.profile.findUnique({
          where: { id: alvo },
          select: { id: true, username: true, bio: true, createdAt: true },
        });
        if (!p) return vazio;
        return {
          snapshotText: p.bio?.slice(0, 2000) ?? null,
          snapshotAuthorId: p.id,
          snapshotAuthorName: p.username,
          snapshotAt: p.createdAt,
        };
      }
    } catch {
      // Ver o cabeçalho: a denúncia vale mesmo sem prova.
    }
    return vazio;
  }
}
