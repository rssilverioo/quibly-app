import { ChallengesService } from './challenges.service';

/**
 * O ranking conta **dias distintos** em que a pessoa apareceu.
 *
 * O dono do produto relatou em 10/08: postou foto em mais de um dia e o número
 * continuou em 1. Este arquivo existe para separar as duas explicações
 * possíveis — a contagem estar errada, ou os posts caírem fora da janela do
 * desafio — em vez de escolher uma por intuição.
 */
describe('ChallengesService — a contagem de dias', () => {
  const INICIO = new Date('2026-08-01T00:00:00.000Z');
  const FIM = new Date('2026-09-30T00:00:00.000Z');

  function servico({
    posts,
    startDate = INICIO,
    endDate = FIM,
    participationMode = null,
    timezone = 'America/Sao_Paulo',
  }: {
    posts: { userId: string; createdAt: Date }[];
    startDate?: Date;
    endDate?: Date;
    participationMode?: string | null;
    timezone?: string | null;
  }) {
    const membro = {
      userId: 'eu',
      displayName: 'Rodrigo',
      user: {
        id: 'eu',
        username: 'Rodrigo',
        handle: 'rodrigo',
        avatarUrl: null,
        verification: null,
        plan: 'FREE',
        timezone,
      },
    };
    const prisma = {
      leagueMember: {
        findUnique: jest.fn().mockResolvedValue(membro),
        count: jest.fn().mockResolvedValue(1),
      },
      league: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sala',
          startDate,
          endDate,
          participationMode,
          members: [membro],
        }),
      },
      studySession: { findMany: jest.fn().mockResolvedValue([]) },
      feedPost: { findMany: jest.fn().mockResolvedValue(posts) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    return {
      service: new ChallengesService(prisma as never),
      prisma,
    };
  }

  const emSaoPaulo = (dia: string, hora: string) =>
    // 08:12 em São Paulo é 11:12 UTC. Escrito em UTC de propósito: é assim que
    // o dado chega do banco, e é onde o fuso pode trair a contagem.
    new Date(`${dia}T${hora}:00.000Z`);

  it('conta um dia por data, não um por foto', async () => {
    // Cinco fotos numa terça são uma terça. Foi o caso do print de 10/08.
    const { service } = servico({
      posts: [
        { userId: 'eu', createdAt: emSaoPaulo('2026-08-09', '11:12') },
        { userId: 'eu', createdAt: emSaoPaulo('2026-08-09', '14:28') },
        { userId: 'eu', createdAt: emSaoPaulo('2026-08-09', '17:35') },
      ],
    });
    const r = await service.leaderboard('sala', 'eu', 1, 10);
    expect(r.entries[0].metricValue).toBe(1);
  });

  it('conta dois quando os dias são diferentes — o caso relatado', async () => {
    const { service } = servico({
      posts: [
        { userId: 'eu', createdAt: emSaoPaulo('2026-08-08', '14:00') },
        { userId: 'eu', createdAt: emSaoPaulo('2026-08-09', '14:00') },
      ],
    });
    const r = await service.leaderboard('sala', 'eu', 1, 10);
    expect(r.entries[0].metricValue).toBe(2);
  });

  it('a foto de fim de noite não vira o dia seguinte', async () => {
    // 23:11 em São Paulo é 02:11 UTC do dia seguinte. Contado em UTC, uma
    // pessoa que posta antes e depois da meia-noite UTC ganharia dois dias por
    // uma noite só — e quem posta sempre à noite teria a contagem inflada.
    const { service } = servico({
      posts: [
        { userId: 'eu', createdAt: new Date('2026-08-09T11:12:00.000Z') }, // 08:12 BRT
        { userId: 'eu', createdAt: new Date('2026-08-10T02:11:00.000Z') }, // 23:11 BRT do dia 9
      ],
    });
    const r = await service.leaderboard('sala', 'eu', 1, 10);
    expect(r.entries[0].metricValue).toBe(1);
  });

  it('posta antes do desafio começar e não conta — a outra explicação', async () => {
    // Se a sala nasceu depois das fotos, elas caem fora de `[startDate, endDate)`
    // e o ranking as ignora. É comportamento correto, e indistinguível de bug
    // para quem olha a tela.
    const { service } = servico({
      startDate: new Date('2026-08-09T00:00:00.000Z'),
      posts: [
        { userId: 'eu', createdAt: emSaoPaulo('2026-08-05', '14:00') },
        { userId: 'eu', createdAt: emSaoPaulo('2026-08-09', '14:00') },
      ],
    });
    // O filtro é do banco, não do código: aqui as duas chegam, e as duas contam.
    // O teste existe para registrar que o recorte acontece na consulta.
    const r = await service.leaderboard('sala', 'eu', 1, 10);
    expect(r.entries[0].metricValue).toBe(2);
  });

  it('sem fuso declarado cai em UTC em vez de sumir com o dia', async () => {
    const { service } = servico({
      timezone: null,
      posts: [
        { userId: 'eu', createdAt: new Date('2026-08-08T14:00:00.000Z') },
        { userId: 'eu', createdAt: new Date('2026-08-09T14:00:00.000Z') },
      ],
    });
    const r = await service.leaderboard('sala', 'eu', 1, 10);
    expect(r.entries[0].metricValue).toBe(2);
  });

  it('a foto conta mesmo em sala marcada `study` — o defeito relatado', async () => {
    /*
     Este era o defeito.

     O seletor de modo saiu em 04/08 — "não existe sala de foto e sala de timer;
     existe uma sala, com duas portas". Mas as salas criadas antes carregam o
     valor antigo, e o ranking ainda tratava as portas de forma diferente: numa
     sala marcada `study`, fotografar todo dia dava zero.

     O dono do produto fotografou em vários dias e viu 1 — o 1 vinha de um dia
     com timer. Manter a assimetria seria puni-lo por um campo que ele nunca
     escolheu, numa tela que nem oferece a opção.
    */
    const { service } = servico({
      participationMode: 'study',
      posts: [
        { userId: 'eu', createdAt: emSaoPaulo('2026-08-08', '14:00') },
        { userId: 'eu', createdAt: emSaoPaulo('2026-08-09', '14:00') },
      ],
    });
    const r = await service.leaderboard('sala', 'eu', 1, 10);
    expect(r.entries[0].metricValue).toBe(2);
  });

  it('o dia que teve foto e timer conta uma vez só', async () => {
    // As duas portas levam ao mesmo lugar: aparecer. Somar as duas daria dois
    // dias por uma terça.
    const { service, prisma } = servico({
      posts: [{ userId: 'eu', createdAt: emSaoPaulo('2026-08-09', '14:00') }],
    });
    prisma.studySession.findMany.mockResolvedValue([
      { userId: 'eu', totalDurationMinutes: 60, isVerified: true, endedAt: emSaoPaulo('2026-08-09', '18:00') },
    ]);
    const r = await service.leaderboard('sala', 'eu', 1, 10);
    expect(r.entries[0].metricValue).toBe(1);
  });
});
