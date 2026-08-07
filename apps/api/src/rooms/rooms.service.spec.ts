import { RoomsService } from './rooms.service';

describe('RoomsService.listForUser', () => {
  it('embeds the active challenge and its remaining deadline', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-03T12:00:00.000Z'));
    const prisma = {
      leagueMember: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            role: 'member',
            displayName: 'Rô',
            totalSp: 120,
            league: {
              id: 'room-1',
              name: 'Cadeira do fundo',
              description: 'Semana da prova',
              startDate: new Date('2026-08-01T00:00:00.000Z'),
              endDate: new Date('2026-08-04T12:00:00.000Z'),
              members: [
                { userId: 'user-2', totalSp: 200 },
                { userId: 'user-1', totalSp: 120 },
              ],
              feedPosts: [{ createdAt: new Date('2026-08-03T11:00:00.000Z') }],
            },
          },
        ]),
      },
    };

    const challenges = {
      leaderboard: jest.fn().mockResolvedValue({ me: { rank: 2, metricValue: 47 } }),
    };
    const [room] = await new RoomsService(
      prisma as any,
      {} as any,
      challenges as any,
      {} as any,
    ).listForUser('user-1');

    expect(room.activeChallenge).toEqual(
      expect.objectContaining({
        id: 'room-1',
        endsAt: new Date('2026-08-04T12:00:00.000Z'),
        remainingSeconds: 86_400,
        me: { rank: 2, metricValue: 47 },
      }),
    );
    expect(prisma.leagueMember.findMany).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('returns no active challenge outside the league window', async () => {
    const prisma = {
      leagueMember: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: 'owner',
            displayName: 'Rô',
            totalSp: 0,
            league: {
              id: 'room-1',
              name: 'Room',
              description: null,
              startDate: new Date('2020-01-01'),
              endDate: new Date('2020-01-02'),
              members: [],
              feedPosts: [],
            },
          },
        ]),
      },
    };

    const [room] = await new RoomsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    ).listForUser('user-1');

    expect(room.activeChallenge).toBeNull();
  });

  it('creates a private room from only name and display name', async () => {
    const leagues = {
      create: jest.fn().mockResolvedValue({
        id: 'room-1',
        name: 'Sala',
        inviteCode: 'ABC12345',
        maxMembers: 50,
        createdAt: new Date(),
      }),
    };
    const service = new RoomsService({} as any, leagues as any, {} as any, {} as any);

    const room = await service.create('user-1', {
      name: 'Sala',
      display_name: 'Rô',
    });

    expect(leagues.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ privacy: 'private', display_name: 'Rô' }),
    );
    expect(room.activeChallenge).toBeNull();
  });

  it('creates a standalone photo post without a session', async () => {
    const prisma = {
      leagueMember: { findUnique: jest.fn().mockResolvedValue({ id: 'member-1' }) },
      feedPost: {
        create: jest.fn().mockImplementation(({ data }) => ({
          ...data,
          createdAt: new Date('2026-07-31T12:00:00Z'),
        })),
      },
    };
    const storage = {
      uploadPublic: jest.fn().mockResolvedValue('https://cdn.example/photo.jpg'),
    };
    const service = new RoomsService(
      prisma as any,
      {} as any,
      {} as any,
      storage as any,
    );

    const result = await service.createPost(
      'room-1',
      'user-1',
      '  foco hoje  ',
      { buffer: Buffer.from('image'), mimetype: 'image/jpeg' } as Express.Multer.File,
    );

    expect(prisma.feedPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leagueId: 'room-1',
        userId: 'user-1',
        sessionId: null,
        caption: 'foco hoje',
        photoUrl: 'https://cdn.example/photo.jpg',
      }),
    });
    expect(result).toEqual(expect.objectContaining({ kind: 'standalone' }));
  });
});

/**
 * A sala nascia inerte: sem desafio, `isStudyChallenge` é falso no cliente, e
 * com ele somem o botão do timer e a faixa de "estudando agora". Criar o
 * desafio era um segundo passo que nada na tela pedia.
 */
describe('RoomsService.create', () => {
  const leagueFake = (over: Record<string, unknown> = {}) => ({
    id: 'room-1',
    name: 'Cursinho 2026',
    inviteCode: 'ABC123',
    maxMembers: 50,
    createdAt: new Date('2026-08-04T10:00:00.000Z'),
    startDate: new Date('2026-08-04T00:00:00.000Z'),
    endDate: new Date('2026-09-03T00:00:00.000Z'),
    participationMode: 'photo',
    ...over,
  });

  const montar = (league = leagueFake()) => {
    const leagues = { create: jest.fn().mockResolvedValue(league) };
    const prisma = {
      league: {
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...league, ...data }),
          ),
      },
    };
    const service = new RoomsService(
      prisma as any,
      leagues as any,
      {} as any,
      {} as any,
    );
    return { service, leagues, prisma };
  };

  it('opens a live challenge window when the client says how long', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-04T10:00:00.000Z'));
    const { service, leagues } = montar();

    const room = await service.create('user-1', {
      name: 'Cursinho 2026',
      display_name: 'Rô',
      participation_mode: 'study',
      duration_days: 30,
    });

    // A janela morta de 1970 é o que fazia `activeChallenge` ser null.
    expect(leagues.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ start_date: '2026-08-04', end_date: '2026-09-03' }),
    );
    expect(room.activeChallenge).toEqual(
      expect.objectContaining({
        participationMode: 'study',
        status: 'active',
        // O título é o nome da sala: quem cria deu um nome só.
        title: 'Cursinho 2026',
        participantCount: 1,
      }),
    );
    jest.useRealTimers();
  });

  it('writes the mode outside CreateLeagueDto, which does not know it', async () => {
    const { service, prisma } = montar();

    await service.create('user-1', {
      name: 'Cursinho 2026',
      display_name: 'Rô',
      participation_mode: 'study',
      duration_days: 30,
    });

    // `League.mode` do leagues.service é outro eixo (rigor de prova). Misturar
    // os dois é o que DIRECAO-PRODUTO proíbe explicitamente.
    expect(prisma.league.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: { participationMode: 'study' },
    });
  });

  it('keeps the old dead window for a client that sends neither field', async () => {
    // A build 1.2.1 está em campo e manda só nome e display_name. Ela precisa
    // continuar criando sala exatamente como antes.
    const { service, leagues, prisma } = montar();

    const room = await service.create('user-1', {
      name: 'Cursinho 2026',
      display_name: 'Rô',
    });

    expect(leagues.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ start_date: '1970-01-01', end_date: '1970-01-02' }),
    );
    expect(room.activeChallenge).toBeNull();
    expect(prisma.league.update).not.toHaveBeenCalled();
  });
});

import { ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * Editar sala é a única superfície onde um membro pode estragar o que é de
 * outro. A checagem de dono é o que separa "o app não tem a tela" de "qualquer
 * um apaga a sala de qualquer um".
 */
describe('RoomsService — só o dono edita a sala', () => {
  const SALA = 'sala-1';
  const DONO = 'user-dono';

  const storage = () => ({
    uploadPublic: jest.fn().mockResolvedValue('https://cdn.tryquibly.com/room-covers/sala-1/1.jpg'),
    chaveDaUrl: jest.fn((url: string) => (url.includes('cdn.tryquibly.com') ? 'room-covers/antiga.jpg' : null)),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  });

  const prismaCom = (league: any) => ({
    league: {
      findUnique: jest.fn().mockResolvedValue(league),
      update: jest.fn().mockImplementation(({ data }) => ({ id: SALA, ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
  });

  const service = (prisma: any, st: any = storage()) =>
    new RoomsService(prisma as any, {} as any, {} as any, st as any);

  const arquivo = { buffer: Buffer.from('x'), mimetype: 'image/jpeg', originalname: 'capa.jpg' };

  it('renomeia quando é o dono', async () => {
    const prisma = prismaCom({ id: SALA, ownerId: DONO, coverUrl: null });

    const r = await service(prisma).update(DONO, SALA, { name: '  Sala nova  ' });

    // O nome vai aparado: espaço nas pontas é erro de digitação, não escolha.
    expect(prisma.league.update.mock.calls[0][0].data.name).toBe('Sala nova');
    expect(r.id).toBe(SALA);
  });

  it.each([
    ['update', (s: RoomsService) => s.update('intruso', SALA, { name: 'x' })],
    ['updateCover', (s: RoomsService) => s.updateCover('intruso', SALA, arquivo)],
    ['remove', (s: RoomsService) => s.remove('intruso', SALA)],
  ])('recusa %s de quem não é dono', async (_caso, acao) => {
    const prisma = prismaCom({ id: SALA, ownerId: DONO, coverUrl: null });

    await expect(acao(service(prisma))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.league.update).not.toHaveBeenCalled();
    expect(prisma.league.delete).not.toHaveBeenCalled();
  });

  it('recusa sala que não existe', async () => {
    const prisma = prismaCom(null);

    await expect(service(prisma).update(DONO, SALA, { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  /**
   * A ordem importa: apagar antes de gravar deixaria a sala sem capa nenhuma se
   * o upload falhasse. Órfão custa bytes; apagado custa a imagem do usuário.
   */
  it('grava a capa nova antes de apagar a antiga', async () => {
    const st = storage();
    const prisma = prismaCom({
      id: SALA, ownerId: DONO, coverUrl: 'https://cdn.tryquibly.com/room-covers/antiga.jpg',
    });

    await service(prisma, st).updateCover(DONO, SALA, arquivo);

    const gravou = prisma.league.update.mock.invocationCallOrder[0];
    const apagou = st.deleteObject.mock.invocationCallOrder[0];
    expect(gravou).toBeLessThan(apagou);
  });

  it('não apaga URL que não é nossa', async () => {
    const st = storage();
    const prisma = prismaCom({
      id: SALA, ownerId: DONO, coverUrl: 'https://exemplo.com/foto.jpg',
    });

    await service(prisma, st).updateCover(DONO, SALA, arquivo);

    // `chaveDaUrl` devolve null para URL de terceiro; apagar às cegas ali
    // miraria uma chave que não é nossa.
    expect(st.deleteObject).not.toHaveBeenCalled();
  });

  it('a capa vai para o prefixo público, sob o id da sala', async () => {
    const st = storage();
    const prisma = prismaCom({ id: SALA, ownerId: DONO, coverUrl: null });

    await service(prisma, st).updateCover(DONO, SALA, arquivo);

    expect(st.uploadPublic.mock.calls[0][0]).toMatch(/^room-covers\/sala-1\/\d+\.jpg$/);
  });

  it('apagar a sala leva a capa junto', async () => {
    const st = storage();
    const prisma = prismaCom({
      id: SALA, ownerId: DONO, coverUrl: 'https://cdn.tryquibly.com/room-covers/antiga.jpg',
    });

    await service(prisma, st).remove(DONO, SALA);

    // O cascade do banco não alcança o storage.
    expect(st.deleteObject).toHaveBeenCalledWith('room-covers/antiga.jpg');
    expect(prisma.league.delete).toHaveBeenCalledWith({ where: { id: SALA } });
  });
});
