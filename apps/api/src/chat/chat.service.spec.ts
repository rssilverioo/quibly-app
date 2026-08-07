import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

const AGORA = new Date('2026-08-07T03:00:00.000Z');

function makePrisma(overrides: any = {}) {
  // `chatMessage` sai do spread final de propósito: deixá-lo lá substituía o
  // objeto inteiro pelo parcial do teste, e os métodos que o teste não cita
  // sumiam.
  const { chatMessage, ...resto } = overrides;

  return {
    leagueMember: {
      findUnique: jest.fn().mockResolvedValue({ id: 'membro-1' }),
    },
    ...resto,
    chatMessage: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      ...chatMessage,
    },
  };
}

const makeGateway = () => ({
  anunciarMensagem: jest.fn(),
  anunciarApagada: jest.fn(),
});

const makeNotifications = () => ({
  notifyChatMessage: jest.fn().mockResolvedValue(undefined),
});

function makeService(prisma: any, gateway = makeGateway()) {
  return {
    service: new ChatService(prisma as any, makeNotifications() as any, gateway as any),
    gateway,
  };
}

/**
 * Apagar uma mensagem não pode apagar a prova.
 *
 * O `delete` que havia aqui removia a linha: depois dele não restava sequer o
 * registro de que algo tinha sido dito. Ofensa apagada pelo próprio autor virava
 * ofensa que nunca existiu.
 */
describe('deleteMessage — marca, não remove', () => {
  const mensagem = { id: 'm1', userId: 'u1', leagueId: 'sala-1' };

  it('grava deletedAt em vez de apagar a linha', async () => {
    const prisma = makePrisma({ chatMessage: { findUnique: jest.fn().mockResolvedValue(mensagem) } });
    const { service } = makeService(prisma);

    await service.deleteMessage('u1', 'm1');

    expect(prisma.chatMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    // A ausência do `delete` é o ponto do teste, não um detalhe.
    expect((prisma.chatMessage as any).delete).toBeUndefined();
  });

  it('continua recusando apagar mensagem alheia', async () => {
    const prisma = makePrisma({
      chatMessage: { findUnique: jest.fn().mockResolvedValue({ ...mensagem, userId: 'outro' }) },
    });
    const { service } = makeService(prisma);

    await expect(service.deleteMessage('u1', 'm1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chatMessage.update).not.toHaveBeenCalled();
  });

  it('anuncia a lápide para a sala, para aparecer na hora', async () => {
    const prisma = makePrisma({ chatMessage: { findUnique: jest.fn().mockResolvedValue(mensagem) } });
    const { service, gateway } = makeService(prisma);

    await service.deleteMessage('u1', 'm1');

    expect(gateway.anunciarApagada).toHaveBeenCalledWith('sala-1', 'm1');
  });
});

/**
 * Guardar para moderação e devolver para a sala são coisas diferentes.
 */
describe('getMessages — o texto apagado não sai do servidor', () => {
  it('zera o conteúdo de mensagem apagada, mantendo autor e hora', async () => {
    const prisma = makePrisma({
      chatMessage: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'm1', content: 'ofensa', deletedAt: AGORA, createdAt: AGORA, userId: 'u1' },
          { id: 'm2', content: 'oi', deletedAt: null, createdAt: AGORA, userId: 'u2' },
        ]),
      },
    });
    const { service } = makeService(prisma);

    const { messages } = await service.getMessages('sala-1', 'u1');

    expect(messages[0].content).toBe('');
    // O que sustenta a investigação continua viajando: quem e quando.
    expect(messages[0].deletedAt).toEqual(AGORA);
    expect(messages[0].userId).toBe('u1');
    // A mensagem viva não é tocada.
    expect(messages[1].content).toBe('oi');
  });

  it('recusa quem não é da sala', async () => {
    const prisma = makePrisma({ leagueMember: { findUnique: jest.fn().mockResolvedValue(null) } });
    const { service } = makeService(prisma);

    await expect(service.getMessages('sala-1', 'intruso')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

/**
 * O expurgo é o outro lado da retenção: o que faz "guardar para moderação" não
 * virar "guardar para sempre".
 */
describe('purgarConteudoVencido', () => {
  it('esvazia só o que foi apagado antes do limite e ainda tem conteúdo', async () => {
    const prisma = makePrisma();
    const { service } = makeService(prisma);

    await service.purgarConteudoVencido(90, AGORA);

    const [args] = prisma.chatMessage.updateMany.mock.calls[0];
    // 90 dias antes de 07/08/2026 é 09/05/2026.
    expect(args.where.deletedAt.lt).toEqual(new Date('2026-05-09T03:00:00.000Z'));
    expect(args.where.deletedAt.not).toBeNull();
    // Sem este filtro a varredura reescreveria as mesmas linhas todo dia, e
    // `purgedAt` passaria a mentir sobre quando o expurgo aconteceu.
    expect(args.where.purgedAt).toBeNull();
    expect(args.data).toEqual({ content: '', purgedAt: AGORA });
  });

  it('nunca expurga mensagem viva por idade', async () => {
    const prisma = makePrisma();
    const { service } = makeService(prisma);

    await service.purgarConteudoVencido(90, AGORA);

    // Retenção de conversa ativa é outra política, e não se decide dentro de
    // uma varredura de mensagens apagadas.
    const [args] = prisma.chatMessage.updateMany.mock.calls[0];
    expect(args.where.deletedAt.not).toBeNull();
  });
});

describe('sendMessage — a sala recebe na hora', () => {
  it('anuncia depois de gravar, com o id do banco', async () => {
    const gravada = { id: 'm-novo', leagueId: 'sala-1', content: 'oi', user: { username: 'ana' } };
    const prisma = makePrisma({
      chatMessage: { create: jest.fn().mockResolvedValue(gravada) },
    });
    const { service, gateway } = makeService(prisma);

    await service.sendMessage('u1', 'sala-1', 'oi');

    // É o id do banco que reconcilia a bolha otimista já na tela do autor.
    expect(gateway.anunciarMensagem).toHaveBeenCalledWith(
      'sala-1',
      expect.objectContaining({ id: 'm-novo' }),
    );
  });

  it('emite em snake_case, como o REST — e não em duas formas', async () => {
    const prisma = makePrisma({
      chatMessage: {
        create: jest.fn().mockResolvedValue({
          id: 'm1',
          leagueId: 'sala-1',
          createdAt: AGORA,
          messageType: 'text',
          user: { avatarUrl: 'https://x/a.png' },
        }),
      },
    });
    const { service, gateway } = makeService(prisma);

    await service.sendMessage('u1', 'sala-1', 'oi');

    const [, payload] = gateway.anunciarMensagem.mock.calls[0];
    // O socket não passa pelo interceptor de HTTP: sem a conversão, a mesma
    // mensagem chegaria com chaves diferentes conforme o caminho.
    expect(payload).toMatchObject({
      league_id: 'sala-1',
      message_type: 'text',
      created_at: AGORA.toISOString(),
      user: { avatar_url: 'https://x/a.png' },
    });
  });
});
