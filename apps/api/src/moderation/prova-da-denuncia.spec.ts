import { ModerationService } from './moderation.service';

/**
 * A denúncia tem que sobreviver ao apagamento do conteúdo.
 *
 * Antes ela guardava só `targetId`. Quem foi denunciado apagava a mensagem em
 * dois toques e a denúncia virava um ponteiro para o nada — quem fosse julgar
 * abriria o painel e não veria nada. **Apagar seria o caminho para escapar**, e
 * é literalmente o que alguém denunciado faz.
 */
describe('ModerationService — a prova é fotografada na hora', () => {
  function servico(mensagem: unknown) {
    const prisma = {
      chatMessage: { findUnique: jest.fn().mockResolvedValue(mensagem) },
      contentReport: { upsert: jest.fn().mockResolvedValue({}) },
    };
    return { service: new ModerationService(prisma as never), prisma };
  }

  const denuncia = {
    targetType: 'chat_message',
    targetId: 'msg-1',
    reason: 'harassment',
  };

  it('copia texto, autor e hora do conteúdo denunciado', async () => {
    const { service, prisma } = servico({
      content: 'mensagem ofensiva',
      createdAt: new Date('2026-08-09T12:00:00Z'),
      leagueId: 'sala-1',
      user: { id: 'agressor', username: 'Fulano' },
    });

    await service.denunciar('quem-denunciou', denuncia);

    const gravado = prisma.contentReport.upsert.mock.calls[0][0].create;
    expect(gravado.snapshotText).toBe('mensagem ofensiva');
    expect(gravado.snapshotAuthorId).toBe('agressor');
    expect(gravado.snapshotAuthorName).toBe('Fulano');
    expect(gravado.snapshotRoomId).toBe('sala-1');
  });

  it('não copia a conversa em volta — só o que foi denunciado', () => {
    // Decisão do dono do produto: o admin vê o que alguém apontou, e nada além.
    // Salas são grupos privados, e a diferença entre "temos moderação" e "lemos
    // as conversas dos usuários" é exatamente esta linha.
    const codigo = require('node:fs').readFileSync(
      require('node:path').join(__dirname, 'moderation.service.ts'),
      'utf8',
    );
    expect(codigo).not.toMatch(/findMany[\s\S]{0,200}chatMessage/);
    expect(codigo).not.toContain('take: 5');
  });

  it('a denúncia vale mesmo quando a foto falha', async () => {
    // Conteúdo já apagado entre o toque e a chamada, por exemplo. Recusar a
    // denúncia perderia as duas coisas — a prova e o registro de que alguém se
    // incomodou.
    const { service, prisma } = servico(null);
    await expect(service.denunciar('quem', denuncia)).resolves.toEqual({ reported: true });
    expect(prisma.contentReport.upsert).toHaveBeenCalled();
    expect(prisma.contentReport.upsert.mock.calls[0][0].create.snapshotText).toBeUndefined();
  });

  it('denunciar de novo não refotografa', async () => {
    // A primeira foto é a do momento em que a pessoa se sentiu ofendida. Refazer
    // deixaria "limpar" a evidência editando o conteúdo e pedindo nova denúncia.
    const { service, prisma } = servico({
      content: 'texto',
      createdAt: new Date(),
      leagueId: 's',
      user: { id: 'a', username: 'A' },
    });
    await service.denunciar('quem', denuncia);
    const update = prisma.contentReport.upsert.mock.calls[0][0].update;
    expect(update.snapshotText).toBeUndefined();
    expect(Object.keys(update).sort()).toEqual(['details', 'reason']);
  });
});
