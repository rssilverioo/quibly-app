import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
        blocked: { select: { id: true, username: true, handle: true, avatarUrl: true } },
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
      },
      // Denunciar de novo não empilha na fila; atualiza o motivo.
      update: { reason: dados.reason, details: dados.details?.trim()?.slice(0, 500) || null },
    });

    return { reported: true };
  }
}
