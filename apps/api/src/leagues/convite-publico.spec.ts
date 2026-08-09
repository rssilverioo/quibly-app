import { NotFoundException } from '@nestjs/common';

import { ConvitePublicoController } from './convite-publico.controller';

/**
 * A única rota sem login do app — e por isso a única que um desconhecido
 * alcança. O que ela devolve é o teto do que vaza sem autenticação nenhuma.
 */
describe('ConvitePublicoController', () => {
  const salaCompleta = {
    name: 'Medicina 2026',
    description: 'Todo dia, sem falta',
    coverUrl: 'https://cdn.test/capa.jpg',
    maxMembers: 50,
    owner: { username: 'Rodrigo', avatarUrl: 'https://cdn.test/r.jpg' },
    _count: { members: 7 },
    // Colunas que o `select` não pede. Estão aqui para provar que, se alguém
    // trocar o `select` por um `include`, o teste cai antes do deploy.
    id: 'sala-interna',
    inviteCode: 'ABCD1234',
    ownerId: 'u1',
  };

  function controlador(sala: unknown) {
    const prisma = { league: { findUnique: jest.fn().mockResolvedValue(sala) } };
    return new ConvitePublicoController(prisma as never);
  }

  it('devolve o suficiente para a pessoa reconhecer a sala', async () => {
    const preview = await controlador(salaCompleta).previewPublico('ABCD1234');

    expect(preview).toEqual({
      name: 'Medicina 2026',
      description: 'Todo dia, sem falta',
      cover_url: 'https://cdn.test/capa.jpg',
      owner: { username: 'Rodrigo', avatar_url: 'https://cdn.test/r.jpg' },
      member_count: 7,
      is_full: false,
    });
  });

  it('não devolve id, código nem qualquer coisa interna', async () => {
    const preview = (await controlador(salaCompleta).previewPublico('ABCD1234')) as Record<
      string,
      unknown
    >;

    expect(Object.keys(preview).sort()).toEqual([
      'cover_url',
      'description',
      'is_full',
      'member_count',
      'name',
      'owner',
    ]);
    // O dono aparece com nome e rosto, e nada além: sem e-mail, sem handle,
    // sem id — o convite responde "é esta sala mesmo?", não "quem é essa gente".
    expect(Object.keys(preview.owner as object).sort()).toEqual(['avatar_url', 'username']);
  });

  it('marca a sala cheia, para a página não convidar para uma porta fechada', async () => {
    const cheia = { ...salaCompleta, maxMembers: 7 };
    expect((await controlador(cheia).previewPublico('ABCD1234')).is_full).toBe(true);
  });

  it('código desconhecido é 404, igual a código malformado', async () => {
    // A mesma resposta para os dois casos de propósito: distinguir entregaria
    // o formato do código a quem está tentando chutar.
    await expect(controlador(null).previewPublico('nao-existe')).rejects.toThrow(NotFoundException);
  });
});
