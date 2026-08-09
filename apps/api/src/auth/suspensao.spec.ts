import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { FirebaseAuthGuard } from './guards/firebase-auth.guard';

/**
 * Conta suspensa não passa do guard.
 *
 * A suspensão é aplicada aqui, e não em cada rota, porque suspensão que cobre
 * só algumas rotas não é suspensão: quem quisesse continuar postando acharia o
 * caminho que ninguém protegeu.
 */
describe('FirebaseAuthGuard — suspensão', () => {
  function guardComPerfil(perfil: unknown) {
    const firebase = {
      getAuth: () => ({
        verifyIdToken: jest.fn().mockResolvedValue({ uid: 'u1', email: 'a@b.c' }),
      }),
    };
    const prisma = {
      profile: {
        findUnique: jest.fn().mockResolvedValue(perfil),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const guard = new FirebaseAuthGuard(firebase as never, prisma as never);
    const contexto = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer t' } }),
      }),
    };
    return { guard, contexto: contexto as never, prisma };
  }

  it('recusa quem está suspenso', async () => {
    const { guard, contexto } = guardComPerfil({ bannedAt: new Date() });
    await expect(guard.canActivate(contexto)).rejects.toThrow(ForbiddenException);
  });

  it('deixa passar quem não está', async () => {
    const { guard, contexto } = guardComPerfil({ bannedAt: null });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
  });

  it('recusa com 403, e não com 401', async () => {
    // 401 faria o app tentar renovar o token e entrar num laço de login que
    // nunca conclui, sem nunca dizer o que houve.
    const { guard, contexto } = guardComPerfil({ bannedAt: new Date() });
    await expect(guard.canActivate(contexto)).rejects.not.toThrow(UnauthorizedException);
  });

  it('consulta o banco a cada requisição, e não o cache de perfis', async () => {
    // `knownProfiles` é povoado uma vez por processo. Se a suspensão dependesse
    // dele, banir alguém que já usou o app naquele processo não teria efeito
    // até o próximo deploy — a pior forma de uma punição falhar, porque parece
    // aplicada.
    const { guard, contexto, prisma } = guardComPerfil({ bannedAt: null });
    await guard.canActivate(contexto);
    await guard.canActivate(contexto);
    expect(prisma.profile.findUnique).toHaveBeenCalledTimes(2);
  });
});
