import { UsersService } from './users.service';

/**
 * As estatísticas do Pro: 403 `PRO_REQUIRED` no grátis; no Pro, o histórico
 * lido por semana, por matéria e por hora.
 */
describe('UsersService.getInsights', () => {
  const agora = new Date('2026-08-06T14:00:00.000Z'); // quinta-feira
  beforeAll(() => { jest.useFakeTimers().setSystemTime(agora); });
  afterAll(() => { jest.useRealTimers(); });

  const sessoes = [
    // hoje, 60 min de Matemática às 14h UTC
    { endedAt: new Date('2026-08-06T14:30:00.000Z'), totalDurationMinutes: 60, subject: { id: 'mat', name: 'Matemática' } },
    // semana passada, 30 min de História às 20h
    { endedAt: new Date('2026-07-29T20:10:00.000Z'), totalDurationMinutes: 30, subject: { id: 'his', name: 'História' } },
    // 40 dias atrás: entra nas semanas, não nos 30 dias
    { endedAt: new Date('2026-06-27T14:10:00.000Z'), totalDurationMinutes: 45, subject: { id: 'mat', name: 'Matemática' } },
  ];

  function servico(plan: 'FREE' | 'PRO') {
    const prisma = {
      profile: { findUnique: jest.fn().mockResolvedValue({ plan }) },
      studySession: { findMany: jest.fn().mockResolvedValue(sessoes) },
    };
    const entitlements = { getLimit: jest.fn().mockResolvedValue(plan === 'PRO' ? Infinity : 0) };
    return new UsersService(prisma as any, {} as any, {} as any, entitlements as any);
  }

  it('grátis recebe PRO_REQUIRED', async () => {
    await expect(servico('FREE').getInsights('u1')).rejects.toMatchObject({
      response: { code: 'PRO_REQUIRED' },
    });
  });

  it('Pro recebe 8 semanas, matérias dos 30 dias e a melhor hora', async () => {
    const r = await servico('PRO').getInsights('u1');
    expect(r.semanas).toHaveLength(8);
    // A semana corrente (começa segunda 03/08) é a última e tem os 60 de hoje.
    expect(r.semanas[7]).toEqual({ inicio: '2026-08-03', minutos: 60 });
    expect(r.semanas[6]).toEqual({ inicio: '2026-07-27', minutos: 30 });
    // A sessão de 27/06 é anterior às 8 semanas (início 08/06)? Não: entra na 3ª.
    expect(r.semanas.reduce((a, w) => a + w.minutos, 0)).toBe(135);
    // Matérias só dos últimos 30 dias: a de junho fica de fora.
    expect(r.materias).toEqual([
      { id: 'mat', nome: 'Matemática', minutos: 60 },
      { id: 'his', nome: 'História', minutos: 30 },
    ]);
    expect(r.melhorHora).toEqual({ hora: 14, minutos: 60 });
    expect(r.total30Dias).toBe(90);
  });
});
