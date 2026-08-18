import { Plan } from '@prisma/client';
import { RevenueCatService } from './revenuecat.service';

/**
 * O webhook é o único lugar do sistema que decide quem é PRO — e, desde o teste
 * grátis, também quem está usando o produto **sem ter pago nada ainda**.
 *
 * Os dois chegam como `INITIAL_PURCHASE`, com o mesmo produto e o mesmo
 * usuário. O que os separa é uma string no corpo do evento. Confundi-los custa
 * nas duas direções: contar teste como receita infla o número que decide as
 * próximas decisões, e não contar a conversão apaga a receita de verdade que
 * chega dias depois.
 */
function montar() {
  const profile = {
    update: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn().mockResolvedValue({ subscriptionStatus: 'active' }),
  };
  const analytics = { track: jest.fn() };
  const service = new RevenueCatService(
    { profile } as never,
    { getOrThrow: () => 'chave-de-teste' } as never,
    analytics as never,
  );
  return { service, profile, analytics };
}

const evento = (event: Record<string, unknown>) =>
  ({ api_version: '1.0', event: { app_user_id: 'u1', store: 'APP_STORE', ...event } }) as never;

const dadosDoUpdate = (profile: { update: jest.Mock }) =>
  profile.update.mock.calls[0][0].data;

const eventosRegistrados = (analytics: { track: jest.Mock }) =>
  analytics.track.mock.calls.map((c) => c[0]);

describe('webhook do RevenueCat — teste grátis', () => {
  it('dá PRO a quem começou o teste', async () => {
    const { service, profile } = montar();

    await service.handleWebhook(
      evento({ type: 'INITIAL_PURCHASE', period_type: 'TRIAL', product_id: 'pro.monthly' }),
    );

    // O acesso durante o teste é o acesso do Pro — é disso que a pessoa vai
    // sentir falta quando acabar.
    expect(dadosDoUpdate(profile).plan).toBe(Plan.PRO);
    expect(dadosDoUpdate(profile).subscriptionStatus).toBe('trialing');
  });

  /**
   * O erro caro na direção da receita. `purchase_completed` significa que o
   * dinheiro saiu da conta de alguém; num teste grátis não saiu, e boa parte
   * dele nunca vai sair.
   */
  it('não conta o começo do teste como compra', async () => {
    const { service, analytics } = montar();

    await service.handleWebhook(
      evento({ type: 'INITIAL_PURCHASE', period_type: 'TRIAL', product_id: 'pro.monthly' }),
    );

    expect(eventosRegistrados(analytics)).toEqual(['trial_started']);
  });

  it('a compra direta continua sendo compra', async () => {
    const { service, profile, analytics } = montar();

    await service.handleWebhook(
      evento({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL', product_id: 'pro.yearly' }),
    );

    expect(dadosDoUpdate(profile).subscriptionStatus).toBe('active');
    expect(eventosRegistrados(analytics)).toEqual(['purchase_completed']);
    expect(analytics.track.mock.calls[0][2].selected_plan).toBe('yearly');
  });

  /**
   * A conversão. O RevenueCat não manda evento próprio para "o teste virou
   * assinatura" — manda um `RENEWAL` idêntico a qualquer outro, e quem
   * distingue é o estado anterior da pessoa.
   */
  it('reconhece o teste virando assinatura paga', async () => {
    const { service, profile, analytics } = montar();
    profile.findUnique.mockResolvedValue({ subscriptionStatus: 'trialing' });

    await service.handleWebhook(
      evento({ type: 'RENEWAL', period_type: 'NORMAL', product_id: 'pro.monthly' }),
    );

    expect(dadosDoUpdate(profile).subscriptionStatus).toBe('active');
    // A receita entra no funil aqui, e não no dia em que o teste começou.
    expect(eventosRegistrados(analytics)).toEqual(['trial_converted', 'purchase_completed']);
  });

  it('renovação comum de quem já pagava não vira conversão nem compra nova', async () => {
    const { service, profile, analytics } = montar();
    profile.findUnique.mockResolvedValue({ subscriptionStatus: 'active' });

    await service.handleWebhook(
      evento({ type: 'RENEWAL', period_type: 'NORMAL', product_id: 'pro.monthly' }),
    );

    // Contar toda renovação como compra transformaria retenção em aquisição —
    // o funil de monetização passaria a crescer sozinho, sem ninguém novo.
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('registra o teste que acabou sem virar assinatura', async () => {
    const { service, analytics } = montar();

    await service.handleWebhook(evento({ type: 'EXPIRATION', period_type: 'TRIAL' }));

    expect(eventosRegistrados(analytics)).toEqual(['trial_ended']);
    expect(analytics.track.mock.calls[0][2].reason).toBe('expired');
  });

  /**
   * Cancelar dentro do teste e o prazo acabar sozinho apontam para lugares
   * diferentes: o primeiro é expectativa errada criada na tela de preços, o
   * segundo é valor que não chegou no meio da semana.
   */
  it('separa cancelamento de expiração', async () => {
    const { service, analytics } = montar();

    await service.handleWebhook(evento({ type: 'CANCELLATION', period_type: 'TRIAL' }));

    expect(analytics.track.mock.calls[0][2].reason).toBe('canceled');
  });

  /**
   * O mesmo teste não pode aparecer duas vezes no funil. Quem cancela no dia 2
   * recebe o `EXPIRATION` no dia 7 — e ali já não há nada de novo a contar.
   */
  it('não conta duas vezes o teste que foi cancelado e depois expirou', async () => {
    const { service, profile, analytics } = montar();
    profile.findUnique.mockResolvedValue({ subscriptionStatus: 'trialing_canceled' });

    await service.handleWebhook(evento({ type: 'EXPIRATION', period_type: 'TRIAL' }));

    expect(analytics.track).not.toHaveBeenCalled();
  });
});

/**
 * Cancelar não é perder o acesso.
 *
 * Até 18/08/2026 era: `CANCELLATION` dividia linha com `EXPIRATION` e derrubava
 * o PRO na hora. Quem cancelava no dia 20 de um mês pago até o dia 30 perdia
 * dez dias já comprados — enquanto a Apple, do lado dela, seguia contando esses
 * dez dias normalmente.
 */
describe('webhook do RevenueCat — cancelamento', () => {
  it('desliga a renovação e mantém o acesso', async () => {
    const { service, profile } = montar();

    await service.handleWebhook(
      evento({ type: 'CANCELLATION', period_type: 'NORMAL', cancel_reason: 'UNSUBSCRIBE' }),
    );

    const dados = dadosDoUpdate(profile);
    expect(dados.subscriptionStatus).toBe('canceled');
    // O que não pode estar aqui: `plan: FREE`. O acesso acaba no
    // `EXPIRATION`, no fim do período que a pessoa já pagou.
    expect(dados.plan).toBeUndefined();
  });

  it('marca o teste cancelado com estado próprio', async () => {
    const { service, profile } = montar();
    profile.findUnique.mockResolvedValue({ subscriptionStatus: 'trialing' });

    await service.handleWebhook(evento({ type: 'CANCELLATION', period_type: 'TRIAL' }));

    // Separado de `canceled` porque quem cancela no teste nunca pagou nada —
    // e porque é ele que impede o `EXPIRATION` de recontar o mesmo teste.
    expect(dadosDoUpdate(profile).subscriptionStatus).toBe('trialing_canceled');
  });

  /**
   * A exceção: reembolso pelo suporte da loja. O dinheiro voltou para a
   * pessoa, e o produto volta para nós no mesmo instante.
   */
  it('reembolso tira o acesso na hora', async () => {
    const { service, profile } = montar();

    await service.handleWebhook(
      evento({ type: 'CANCELLATION', period_type: 'NORMAL', cancel_reason: 'CUSTOMER_SUPPORT' }),
    );

    expect(dadosDoUpdate(profile).plan).toBe(Plan.FREE);
    expect(dadosDoUpdate(profile).subscriptionStatus).toBe('expired');
  });

  it('falha de cobrança também mantém o acesso até o fim do período', async () => {
    const { service, profile } = montar();

    await service.handleWebhook(
      evento({ type: 'CANCELLATION', period_type: 'NORMAL', cancel_reason: 'BILLING_ERROR' }),
    );

    // A loja ainda tenta cobrar durante o período de tolerância; quem encerra
    // continua sendo o `EXPIRATION`.
    expect(dadosDoUpdate(profile).plan).toBeUndefined();
  });

  it('a expiração é que tira o acesso', async () => {
    const { service, profile } = montar();
    profile.findUnique.mockResolvedValue({ subscriptionStatus: 'canceled' });

    await service.handleWebhook(evento({ type: 'EXPIRATION', period_type: 'NORMAL' }));

    expect(dadosDoUpdate(profile).plan).toBe(Plan.FREE);
  });

  it('voltar atrás no cancelamento reativa', async () => {
    const { service, profile } = montar();
    profile.findUnique.mockResolvedValue({ subscriptionStatus: 'canceled' });

    await service.handleWebhook(evento({ type: 'UNCANCELLATION', period_type: 'NORMAL' }));

    expect(dadosDoUpdate(profile).subscriptionStatus).toBe('active');
    expect(dadosDoUpdate(profile).plan).toBe(Plan.PRO);
  });

  it('assinatura paga que expira não vira "teste encerrado"', async () => {
    const { service, profile, analytics } = montar();
    profile.findUnique.mockResolvedValue({ subscriptionStatus: 'active' });

    await service.handleWebhook(evento({ type: 'EXPIRATION', period_type: 'NORMAL' }));

    expect(analytics.track).not.toHaveBeenCalled();
    expect(dadosDoUpdate(profile).plan).toBe(Plan.FREE);
  });

  /**
   * Eventos antigos do RevenueCat, e qualquer loja que não mande o campo,
   * chegam sem `period_type`. Ausência não pode virar teste — seria dar acesso
   * marcado como não-pago a quem pagou.
   */
  it('sem period_type, trata como compra normal', async () => {
    const { service, profile, analytics } = montar();

    await service.handleWebhook(evento({ type: 'INITIAL_PURCHASE', product_id: 'pro.monthly' }));

    expect(dadosDoUpdate(profile).subscriptionStatus).toBe('active');
    expect(eventosRegistrados(analytics)).toEqual(['purchase_completed']);
  });
});
