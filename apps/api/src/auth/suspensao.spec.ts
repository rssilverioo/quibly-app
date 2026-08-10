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

/**
 * Nome repetido não pode trancar uma conta para sempre.
 *
 * `handle` é `@unique` e nascia do e-mail: `rodrigo.silverio@…` virava
 * `rodrigo_silverio`. Com esse nome já ocupado, o insert batia na restrição e
 * **toda** requisição daquela conta falhava — não só o cadastro. A pessoa
 * entrava no Firebase normalmente e o app respondia erro para sempre.
 *
 * Apareceu como "Authentication is temporarily unavailable": um `P2002`
 * disfarçado de indisponibilidade.
 */
describe('FirebaseAuthGuard — criação do perfil', () => {
  function guard(upsert: jest.Mock) {
    const firebase = {
      getAuth: () => ({
        verifyIdToken: jest.fn().mockResolvedValue({
          uid: 'abc123XYZ789',
          email: 'rodrigo.silverio@exemplo.com',
        }),
      }),
    };
    const prisma = {
      profile: { findUnique: jest.fn().mockResolvedValue({ bannedAt: null }), upsert },
    };
    const contexto = {
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer t' } }) }),
    };
    return {
      guard: new FirebaseAuthGuard(firebase as never, prisma as never),
      contexto: contexto as never,
      upsert,
    };
  }

  const conflito = (campo: string) =>
    Object.assign(new Error('unique'), { code: 'P2002', meta: { target: [campo] } });

  it('tenta outro handle quando o primeiro está ocupado', async () => {
    const upsert = jest
      .fn()
      .mockRejectedValueOnce(conflito('handle'))
      .mockResolvedValueOnce({});

    const { guard: g, contexto } = guard(upsert);
    await expect(g.canActivate(contexto)).resolves.toBe(true);

    expect(upsert).toHaveBeenCalledTimes(2);
    const primeiro = upsert.mock.calls[0][0].create.handle;
    const segundo = upsert.mock.calls[1][0].create.handle;
    expect(primeiro).toBe('rodrigo_silverio');
    expect(segundo).not.toBe(primeiro);
    // Determinístico: sai do id, então a mesma conta sempre gera o mesmo nome.
    expect(segundo).toContain('xyz789');
  });

  it('e-mail repetido não vira contorno automático', async () => {
    // Dois usuários do Firebase no mesmo e-mail significam conta recriada, e os
    // dados antigos são da antiga. Inventar sufixo no e-mail corromperia o dado.
    const upsert = jest.fn().mockRejectedValue(conflito('email'));
    const { guard: g, contexto } = guard(upsert);
    await expect(g.canActivate(contexto)).rejects.toThrow(/already belongs/i);
  });

  it('erro que não é de unicidade sobe como está', async () => {
    const upsert = jest.fn().mockRejectedValue(Object.assign(new Error('caiu'), { code: 'P1001' }));
    const { guard: g, contexto } = guard(upsert);
    await expect(g.canActivate(contexto)).rejects.toThrow();
  });
});
