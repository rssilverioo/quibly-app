import { Plan } from '@prisma/client';

/**
 * O plano que **vale agora**, que nem sempre é o que está gravado.
 *
 * ## Por que a coluna `plan` sozinha não basta
 *
 * Desde que o cancelamento parou de derrubar o acesso na hora — e ele parou
 * porque quem pagou até o dia 30 tem direito ao dia 29 —, existe um intervalo
 * em que a pessoa está `PRO` com a renovação já desligada. Quem fecha esse
 * intervalo é o `EXPIRATION` do RevenueCat.
 *
 * E o `EXPIRATION` pode não chegar. `revenuecat.controller.ts` responde `200`
 * mesmo quando o processamento estoura — de propósito, para a loja não ficar
 * repetindo evento que nunca vai passar —, e o efeito colateral é que um erro
 * de banco no momento errado consome o único aviso de que a assinatura acabou.
 * Sem esta função, isso é Pro vitalício de graça, silencioso, sem nada no log
 * apontando para ele.
 *
 * ## Por que só para quem cancelou
 *
 * A regra **não** vale para `active` nem para `trialing`. Nesses dois estados
 * uma renovação está a caminho, e webhook de renovação pode atrasar — cortar o
 * acesso de quem acabou de pagar porque a confirmação demorou dois minutos é
 * pior, e mais caro, que o problema que esta função resolve.
 *
 * Ela vale exatamente onde **nenhuma renovação vai chegar**: renovação
 * desligada e prazo vencido. Aí a conclusão é certa, não é palpite.
 */

/** Os estados em que a renovação automática está desligada. */
const SEM_RENOVACAO = new Set(['canceled', 'trialing_canceled']);

export interface PerfilComPlano {
  plan: Plan;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
}

/**
 * O `select` que estas três colunas exigem. Compartilhado para os pontos de
 * cobrança não saírem do ar um a um: quem lê só `plan` volta a errar sozinho, e
 * o erro é invisível — o acesso simplesmente continua.
 */
export const SELECAO_DE_PLANO = {
  plan: true,
  subscriptionStatus: true,
  currentPeriodEnd: true,
} as const;

export function planoEfetivo(
  perfil: PerfilComPlano | null | undefined,
  agora: Date = new Date(),
): Plan {
  if (!perfil) return Plan.FREE;
  if (perfil.plan !== Plan.PRO) return perfil.plan;
  if (!SEM_RENOVACAO.has(perfil.subscriptionStatus ?? '')) return perfil.plan;
  // Cancelado e sem data de fim: não dá para afirmar que acabou, e tirar o
  // acesso de quem talvez ainda tenha direito é o erro que custa mais caro dos
  // dois. Fica PRO até o `EXPIRATION` dizer o contrário.
  if (!perfil.currentPeriodEnd) return perfil.plan;

  return perfil.currentPeriodEnd.getTime() > agora.getTime() ? Plan.PRO : Plan.FREE;
}
