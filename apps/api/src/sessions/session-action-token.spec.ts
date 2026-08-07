import {
  cunharTokenDeAcao,
  lerTokenDeAcao,
  VALIDADE_SEGUNDOS,
} from './session-action-token';

const SEGREDO = 'segredo-de-teste-com-tamanho-razoavel';
const AGORA = new Date('2026-08-07T12:00:00.000Z');
const SESSAO = '11111111-2222-3333-4444-555555555555';
const USUARIO = 'user-1';

const cunhar = (extra: Partial<{ segredo: string; agora: Date }> = {}) =>
  cunharTokenDeAcao(SESSAO, USUARIO, extra.segredo ?? SEGREDO, extra.agora ?? AGORA);

describe('token de ação da sessão', () => {
  it('vai e volta com a sessão e o usuário intactos', () => {
    const token = cunhar()!;

    const lido = lerTokenDeAcao(token, SEGREDO, AGORA);

    expect(lido).toEqual({
      sessionId: SESSAO,
      userId: USUARIO,
      expiraEm: Math.floor(AGORA.getTime() / 1000) + VALIDADE_SEGUNDOS,
    });
  });

  /**
   * O ponto do desenho: o token vale para **uma** sessão. Se ele autorizasse
   * qualquer sessão do usuário, não seria melhor que o token do Firebase.
   */
  it('carrega a sessão a que pertence, e não um usuário genérico', () => {
    const outra = cunharTokenDeAcao('outra-sessao', USUARIO, SEGREDO, AGORA)!;

    expect(lerTokenDeAcao(outra, SEGREDO, AGORA)!.sessionId).toBe('outra-sessao');
    expect(lerTokenDeAcao(cunhar()!, SEGREDO, AGORA)!.sessionId).toBe(SESSAO);
  });

  it('recusa assinatura de outro segredo', () => {
    const token = cunhar({ segredo: 'outro-segredo-qualquer' })!;

    expect(lerTokenDeAcao(token, SEGREDO, AGORA)).toBeNull();
  });

  it('recusa payload adulterado', () => {
    const token = cunhar()!;
    const [, assinatura] = token.split('.');
    const forjado = Buffer.from(
      JSON.stringify({ sessionId: 'sessao-alheia', userId: USUARIO, expiraEm: 9e9 }),
    ).toString('base64url');

    // Trocar o payload mantendo a assinatura é a tentativa óbvia.
    expect(lerTokenDeAcao(`${forjado}.${assinatura}`, SEGREDO, AGORA)).toBeNull();
  });

  it('recusa depois de vencer', () => {
    const token = cunhar()!;
    const depois = new Date(AGORA.getTime() + (VALIDADE_SEGUNDOS + 1) * 1000);

    expect(lerTokenDeAcao(token, SEGREDO, depois)).toBeNull();
  });

  it('ainda vale um segundo antes de vencer', () => {
    const token = cunhar()!;
    const quase = new Date(AGORA.getTime() + (VALIDADE_SEGUNDOS - 1) * 1000);

    expect(lerTokenDeAcao(token, SEGREDO, quase)).not.toBeNull();
  });

  it.each([
    ['vazio', ''],
    ['sem ponto', 'abcdef'],
    ['só o payload', 'abcdef.'],
    ['base64 inválido', '!!!.!!!'],
    ['assinatura de outro tamanho', 'abc.def'],
  ])('recusa token malformado: %s', (_caso, token) => {
    expect(lerTokenDeAcao(token, SEGREDO, AGORA)).toBeNull();
  });

  /**
   * Sem segredo o recurso não existe — e a sessão tem que começar do mesmo
   * jeito. A Live Activity perde os botões, não o cronômetro.
   */
  describe('sem SESSION_ACTION_SECRET', () => {
    it('não cunha token', () => {
      expect(cunharTokenDeAcao(SESSAO, USUARIO, undefined, AGORA)).toBeNull();
      expect(cunharTokenDeAcao(SESSAO, USUARIO, '', AGORA)).toBeNull();
    });

    it('não aceita token nenhum, nem um bem formado', () => {
      // Sem isto, um servidor sem segredo aceitaria qualquer coisa — que é o
      // modo de falhar mais perigoso que este arquivo poderia ter.
      const token = cunhar()!;

      expect(lerTokenDeAcao(token, undefined, AGORA)).toBeNull();
      expect(lerTokenDeAcao(token, '', AGORA)).toBeNull();
    });
  });

  /**
   * O formato lembra um JWT e não é um. Sem cabeçalho com `alg`, o ataque
   * clássico de trocar o algoritmo por `none` não tem onde acontecer.
   */
  it('não expõe um cabeçalho de algoritmo', () => {
    const [payload] = cunhar()!.split('.');
    const decodificado = Buffer.from(payload, 'base64url').toString('utf8');

    expect(decodificado).not.toContain('alg');
    expect(JSON.parse(decodificado)).toEqual({
      sessionId: SESSAO,
      userId: USUARIO,
      expiraEm: expect.any(Number),
    });
  });
});
