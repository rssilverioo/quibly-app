import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { PrismaService } from '../prisma/prisma.service';

/**
 * A única porta da API que **não** pede login.
 *
 * ## Por que existe
 *
 * Quem recebe um convite é, por definição, quem ainda não tem conta. A página
 * `tryquibly.com/join/CODE` precisa dizer **qual sala** e **de quem** antes de
 * pedir qualquer coisa — sem isso o convite chega como um código solto, e a
 * pessoa decide baixar um app sobre o qual não sabe nada.
 *
 * ## Por que é um controller separado, e não um `@Public()`
 *
 * Um decorador de exceção espalha a decisão: o guard passa a poder ser
 * desligado em qualquer método, e descobrir o que está aberto vira uma busca
 * pelo repositório inteiro. Aqui a superfície pública é um arquivo — se ele tem
 * uma rota, ela é pública; se não tem, não existe rota pública.
 *
 * ## O que protege o dado
 *
 * O código é a chave: 8 caracteres num alfabeto de 62, sorteados por
 * `randomBytes`. São ~2×10¹⁴ combinações, então adivinhar não é caminho. O
 * `@Throttle` fecha o resto — 20 por minuto contra o teto global de 200, porque
 * esta é a única rota que um desconhecido alcança.
 *
 * E devolve só o que a página desenha. Nada de lista de membros, e-mail do dono
 * ou id interno: o convite responde "é esta sala mesmo?", não "quem está aqui".
 */
@Controller('invite')
export class ConvitePublicoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':code')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async previewPublico(@Param('code') code: string) {
    const sala = await this.prisma.league.findUnique({
      where: { inviteCode: code },
      select: {
        name: true,
        description: true,
        coverUrl: true,
        maxMembers: true,
        owner: { select: { username: true, avatarUrl: true } },
        _count: { select: { members: true } },
      },
    });

    // Mesma resposta para código inexistente e código malformado: distinguir os
    // dois entregaria de graça o formato do código a quem está tentando chutar.
    if (!sala) throw new NotFoundException('Invite not found');

    return {
      name: sala.name,
      description: sala.description,
      cover_url: sala.coverUrl,
      owner: { username: sala.owner.username, avatar_url: sala.owner.avatarUrl },
      member_count: sala._count.members,
      is_full: sala._count.members >= sala.maxMembers,
    };
  }
}
