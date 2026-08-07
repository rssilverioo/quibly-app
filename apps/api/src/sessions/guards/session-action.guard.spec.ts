import { UnauthorizedException } from '@nestjs/common';
import { SessionActionGuard } from './session-action.guard';
import { cunharTokenDeAcao } from '../session-action-token';

const SEGREDO = 'segredo-de-teste';
const SESSAO = '11111111-2222-3333-4444-555555555555';

const contexto = (request: any) => ({
  switchToHttp: () => ({ getRequest: () => request }),
}) as any;

/**
 * Sem valor padrão de propósito: `guard(undefined)` com um default acionaria o
 * default — semântica de parâmetro opcional em JS — e o teste do servidor sem
 * segredo passaria por engano, testando o caso oposto do que anuncia.
 */
const guard = (segredo: string | undefined) =>
  new SessionActionGuard({ get: () => segredo } as any);

const pedido = (token: string | undefined, id = SESSAO) => ({
  headers: token ? { authorization: `SessionAction ${token}` } : {},
  params: { id },
});

describe('SessionActionGuard', () => {
  const token = () => cunharTokenDeAcao(SESSAO, 'user-1', SEGREDO)!;

  it('deixa passar o token da própria sessão', () => {
    const req = pedido(token());

    expect(guard(SEGREDO).canActivate(contexto(req))).toBe(true);
  });

  /**
   * **O furo que este teste fecha.** Sem comparar o token com a sessão da URL,
   * um token legítimo de uma sessão qualquer encerraria a sessão de outra
   * pessoa — o escopo estaria no comentário e não no código.
   */
  it('recusa token de outra sessão', () => {
    const req = pedido(token(), '99999999-9999-9999-9999-999999999999');

    expect(() => guard(SEGREDO).canActivate(contexto(req))).toThrow(UnauthorizedException);
  });

  it('põe no request o dono que o token afirma, não o que o cliente mandou', () => {
    // O serviço confere a posse da sessão contra este `userId`. Se ele viesse
    // do corpo ou da URL, o token não estaria protegendo nada.
    const req: any = { ...pedido(token()), user: { userId: 'invasor' } };

    guard(SEGREDO).canActivate(contexto(req));

    expect(req.user.userId).toBe('user-1');
  });

  it.each([
    ['sem cabeçalho', undefined],
    ['token forjado', 'nao-e-um-token'],
    ['assinado com outro segredo', cunharTokenDeAcao(SESSAO, 'user-1', 'outro')!],
  ])('recusa %s', (_caso, valor) => {
    expect(() => guard(SEGREDO).canActivate(contexto(pedido(valor)))).toThrow(UnauthorizedException);
  });

  it('recusa o esquema errado no Authorization', () => {
    // `Bearer <token de ação>` não pode passar: o token do Firebase e este não
    // são intercambiáveis, e aceitar os dois esquemas apagaria a distinção.
    const req = { headers: { authorization: `Bearer ${token()}` }, params: { id: SESSAO } };

    expect(() => guard(SEGREDO).canActivate(contexto(req))).toThrow(UnauthorizedException);
  });

  it('sem SESSION_ACTION_SECRET, recusa tudo', () => {
    // Um servidor sem segredo tem que fechar a porta, não abri-la.
    expect(() => guard(undefined).canActivate(contexto(pedido(token())))).toThrow(
      UnauthorizedException,
    );
  });
});
