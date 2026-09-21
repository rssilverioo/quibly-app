import { ForbiddenException } from '@nestjs/common';
import { ChallengesService } from './challenges.service';

/**
 * Criar desafio é do Pro; participar nunca foi.
 *
 * O gate fica depois da checagem de admin: quem não é admin recebe o 403 de
 * permissão, não o paywall.
 */
describe('ChallengesService.create — gate do Pro', () => {
  const dto = { title: 'Semana de provas', metric: 'minutes', ends_on: '2099-01-01' } as any;

  function prisma(plan: 'FREE' | 'PRO', role = 'owner') {
    return {
      leagueMember: { findUnique: jest.fn().mockResolvedValue({ role }), count: jest.fn().mockResolvedValue(1) },
      profile: { findUnique: jest.fn().mockResolvedValue({ plan }) },
      league: {
        findUnique: jest.fn().mockResolvedValue({ id: 'r1', startDate: new Date(0), endDate: new Date(0) }),
        update: jest.fn().mockResolvedValue({ id: 'r1', participationMode: 'photo' }),
      },
    };
  }
  const entitlements = (limite: number) => ({ getLimit: jest.fn().mockResolvedValue(limite) });

  it('grátis recebe 403 com code CHALLENGE_CREATION_PRO', async () => {
    const service = new ChallengesService(prisma('FREE') as any, entitlements(0) as any);
    await expect(service.create('r1', 'u1', dto)).rejects.toMatchObject({
      response: { code: 'CHALLENGE_CREATION_PRO' },
    });
  });

  it('Pro cria', async () => {
    const p = prisma('PRO');
    const service = new ChallengesService(p as any, entitlements(Infinity) as any);
    await service.create('r1', 'u1', dto);
    expect(p.league.update).toHaveBeenCalled();
  });

  it('quem não é admin recebe o 403 de permissão, nunca o paywall', async () => {
    const p = prisma('FREE', 'member');
    const service = new ChallengesService(p as any, entitlements(0) as any);
    const erro = await service.create('r1', 'u1', dto).catch((e) => e);
    expect(erro).toBeInstanceOf(ForbiddenException);
    expect(erro.getResponse()).not.toMatchObject({ code: 'CHALLENGE_CREATION_PRO' });
    expect(p.profile.findUnique).not.toHaveBeenCalled();
  });
});
