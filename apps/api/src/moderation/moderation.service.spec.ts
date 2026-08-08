import { ModerationService } from './moderation.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const prismaFake = () => ({
  userBlock: {
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  contentReport: { upsert: jest.fn().mockResolvedValue({}) },
  profile: { findUnique: jest.fn().mockResolvedValue({ id: 'outro' }) },
});

describe('ModerationService — bloquear', () => {
  it('é idempotente: bloquear de novo não é erro', async () => {
    // Quem já conseguiu o que queria não pode receber uma falha por insistir.
    const prisma = prismaFake();
    const service = new ModerationService(prisma as any);

    await service.bloquear('eu', 'outro');
    await service.bloquear('eu', 'outro');

    // `upsert` nas duas, e nenhuma exceção: é o que idempotente significa aqui.
    expect(prisma.userBlock.upsert).toHaveBeenCalledTimes(2);
  });

  it('recusa bloquear a si mesmo', async () => {
    const service = new ModerationService(prismaFake() as any);
    await expect(service.bloquear('eu', 'eu')).rejects.toThrow(BadRequestException);
  });

  it('recusa bloquear quem não existe', async () => {
    const prisma = prismaFake();
    prisma.profile.findUnique.mockResolvedValue(null);
    const service = new ModerationService(prisma as any);

    await expect(service.bloquear('eu', 'fantasma')).rejects.toThrow(NotFoundException);
  });

  it('devolve um Set de ids, que é o que feed e chat consomem', async () => {
    const prisma = prismaFake();
    prisma.userBlock.findMany.mockResolvedValue([
      { blockedId: 'a' },
      { blockedId: 'b' },
    ]);
    const service = new ModerationService(prisma as any);

    const bloqueados = await service.bloqueadosPor('eu');

    expect(bloqueados).toEqual(new Set(['a', 'b']));
  });
});

/**
 * Denunciar **não** apaga nada, e é a decisão mais importante do módulo: um
 * `POST` de qualquer pessoa derrubando conteúdo alheio seria a ferramenta de
 * abuso mais fácil de usar que o produto teria.
 */
describe('ModerationService — denunciar', () => {
  it('registra a denúncia sem tocar no conteúdo', async () => {
    const prisma = prismaFake();
    const service = new ModerationService(prisma as any);

    await service.denunciar('eu', {
      targetType: 'post',
      targetId: 'post-1',
      reason: 'spam',
    });

    // A denúncia entra na fila, e o conteúdo não é tocado — o serviço nem tem
    // acesso a `feedPost`, que é o que garante isso estruturalmente.
    expect(prisma.contentReport.upsert).toHaveBeenCalled();
  });

  it('nasce pendente, para alguém olhar depois', async () => {
    const prisma = prismaFake();
    const service = new ModerationService(prisma as any);

    await service.denunciar('eu', { targetType: 'post', targetId: 'p1', reason: 'spam' });

    // `status` não é passado: o padrão da coluna é PENDING, e deixá-lo implícito
    // impede que uma chamada futura crie uma denúncia já resolvida.
    const { create } = prisma.contentReport.upsert.mock.calls[0][0];
    expect(create.status).toBeUndefined();
  });

  it('recusa tipo e motivo que a fila não sabe tratar', async () => {
    const service = new ModerationService(prismaFake() as any);

    await expect(
      service.denunciar('eu', { targetType: 'sala', targetId: 'x', reason: 'spam' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.denunciar('eu', { targetType: 'post', targetId: 'x', reason: 'não gostei' }),
    ).rejects.toThrow(BadRequestException);
  });
});
