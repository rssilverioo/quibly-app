import { Plan } from '@prisma/client';
import { planoEfetivo } from './plano-efetivo';

/**
 * A rede que segura o dia em que o `EXPIRATION` não chega.
 *
 * Ela existe porque o cancelamento parou de derrubar o acesso na hora — e essa
 * mudança, sozinha, criaria Pro vitalício de graça toda vez que o webhook de
 * expiração se perdesse. O controller responde `200` mesmo quando o
 * processamento estoura, então "se perder" não é hipótese.
 */
const agora = new Date('2026-08-18T12:00:00Z');
const ontem = new Date('2026-08-17T12:00:00Z');
const amanha = new Date('2026-08-19T12:00:00Z');

describe('plano efetivo', () => {
  it('quem cancelou mantém o Pro até o fim do período pago', () => {
    // O ponto inteiro da correção: pagou até amanhã, usa até amanhã.
    expect(
      planoEfetivo(
        { plan: Plan.PRO, subscriptionStatus: 'canceled', currentPeriodEnd: amanha },
        agora,
      ),
    ).toBe(Plan.PRO);
  });

  it('e perde quando o período vence, mesmo sem o webhook ter chegado', () => {
    expect(
      planoEfetivo(
        { plan: Plan.PRO, subscriptionStatus: 'canceled', currentPeriodEnd: ontem },
        agora,
      ),
    ).toBe(Plan.FREE);
  });

  it('vale igual para o teste grátis cancelado', () => {
    expect(
      planoEfetivo(
        { plan: Plan.PRO, subscriptionStatus: 'trialing_canceled', currentPeriodEnd: ontem },
        agora,
      ),
    ).toBe(Plan.FREE);
  });

  /**
   * A metade que não pode acontecer: webhook de renovação atrasa, e cortar o
   * acesso de quem acabou de pagar é pior — e mais caro — que o problema que
   * esta função resolve.
   */
  it('não encosta em quem tem renovação a caminho', () => {
    for (const status of ['active', 'trialing', 'billing_issue']) {
      expect(
        planoEfetivo({ plan: Plan.PRO, subscriptionStatus: status, currentPeriodEnd: ontem }, agora),
      ).toBe(Plan.PRO);
    }
  });

  it('sem data de fim, não afirma que acabou', () => {
    expect(
      planoEfetivo({ plan: Plan.PRO, subscriptionStatus: 'canceled', currentPeriodEnd: null }, agora),
    ).toBe(Plan.PRO);
  });

  it('quem é FREE continua FREE, e perfil ausente também', () => {
    expect(
      planoEfetivo({ plan: Plan.FREE, subscriptionStatus: null, currentPeriodEnd: null }, agora),
    ).toBe(Plan.FREE);
    expect(planoEfetivo(null, agora)).toBe(Plan.FREE);
  });
});
