import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { Plan } from '@prisma/client';

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  product_id?: string;
  expiration_at_ms?: number;
  /**
   * `TRIAL` | `NORMAL` | `INTRO` | `PROMOTIONAL`.
   *
   * O campo que separa "começou o teste grátis" de "pagou". Os dois chegam como
   * `INITIAL_PURCHASE`, com o mesmo produto e o mesmo usuário — sem ler isto, o
   * servidor conta como receita um dinheiro que ainda não entrou e que em boa
   * parte dos casos nunca vai entrar.
   */
  period_type?: string;
  /**
   * Por que a assinatura foi cancelada: `UNSUBSCRIBE`, `BILLING_ERROR`,
   * `DEVELOPER_INITIATED`, `PRICE_INCREASE`, `CUSTOMER_SUPPORT`, `UNKNOWN`.
   *
   * Quase todos significam "a renovação foi desligada" — a pessoa **continua
   * com acesso** até o fim do período que já pagou. A exceção é
   * `CUSTOMER_SUPPORT`, que é reembolso: o dinheiro voltou, e o acesso vai
   * junto.
   */
  cancel_reason?: string;
  store?: string;
}

/**
 * `subscriptionStatus` durante o teste grátis.
 *
 * Vale um estado próprio, e não `'active'`, por dois motivos que se somam: o
 * painel de receita conta assinantes por este campo, e contar quem não pagou
 * junto com quem pagou infla o número que decide as próximas decisões; e a
 * conversão do teste — a métrica que diz se ele valeu a pena — só é detectável
 * porque o `RENEWAL` chega em cima de alguém que estava aqui.
 *
 * O `plan` continua `PRO`: o acesso durante o teste é o acesso do Pro, e é
 * disso que a pessoa vai sentir falta quando acabar.
 */
const STATUS_EM_TESTE = 'trialing';

/**
 * Renovação desligada, acesso ainda de pé.
 *
 * Dois estados e não um porque o funil precisa saber de onde a pessoa saiu:
 * quem cancela dentro do teste nunca pagou nada, e somar os dois transformaria
 * "perdemos um assinante" e "perdemos um teste" no mesmo número.
 *
 * Também é o que impede contar o mesmo teste duas vezes: quem cancela no dia 2
 * recebe o `EXPIRATION` no dia 7, e sem esta marca o `trial_ended` sairia nos
 * dois.
 */
const STATUS_CANCELADO = 'canceled';
const STATUS_TESTE_CANCELADO = 'trialing_canceled';

/**
 * O único `cancel_reason` que tira o acesso na hora: reembolso feito pelo
 * suporte da loja. O dinheiro voltou para a pessoa; o produto volta para nós.
 */
const REEMBOLSO = 'CUSTOMER_SUPPORT';

interface RevenueCatWebhookBody {
  api_version: string;
  event: RevenueCatEvent;
}

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);
  private readonly webhookAuthKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly analytics: AnalyticsService,
  ) {
    this.webhookAuthKey = this.config.getOrThrow('REVENUECAT_WEBHOOK_AUTH_KEY');
  }

  validateAuthKey(authHeader: string | undefined): boolean {
    if (!authHeader) return false;
    return authHeader === this.webhookAuthKey;
  }

  async handleWebhook(body: RevenueCatWebhookBody): Promise<void> {
    const { event } = body;
    const { type, app_user_id: userId } = event;

    this.logger.log(`Webhook event: ${type} for user ${userId}`);

    const platform = this.mapStoreToPlatform(event.store);
    const expirationDate = event.expiration_at_ms
      ? new Date(event.expiration_at_ms)
      : null;
    const emTeste = event.period_type === 'TRIAL';
    const loja = platform === 'apple' || platform === 'google' ? platform : 'unknown';

    switch (type) {
      case 'INITIAL_PURCHASE':
        await this.activateSubscription(userId, platform, expirationDate, emTeste);
        if (emTeste) {
          // Zero receita. `trial_started` é o denominador de `trial_converted`
          // e nada além disso — o `purchase_completed` desta pessoa sai dias
          // depois, quando a primeira cobrança de verdade passar.
          this.analytics.track(
            'trial_started',
            { userId, plan: Plan.PRO },
            { selected_plan: this.billingCycleFrom(event.product_id), store: loja },
          );
        } else {
          // [SERVER] purchase_completed — the only authoritative signal that
          // money actually moved. Scoped to INITIAL_PURCHASE only: renewals
          // and plan changes aren't the "did the paywall convert" question
          // the monetization funnel cares about.
          this.analytics.track(
            'purchase_completed',
            { userId, plan: Plan.PRO },
            { selected_plan: this.billingCycleFrom(event.product_id), store: loja },
          );
        }
        break;

      case 'RENEWAL': {
        /*
         A renovação que fecha o teste.

         O RevenueCat não manda evento próprio para "o teste virou assinatura":
         manda um `RENEWAL` com `period_type: NORMAL`, idêntico a qualquer
         outra renovação. O que o distingue é o estado **anterior** desta
         pessoa, e por isso a leitura vem antes da escrita — depois de
         `activateSubscription` a evidência já foi sobrescrita.

         É a única leitura extra do webhook, e paga por si: sem ela não existe
         taxa de conversão do teste, que é o número que decide se ele fica.
        */
        const anterior = await this.prisma.profile.findUnique({
          where: { id: userId },
          select: { subscriptionStatus: true },
        });
        await this.activateSubscription(userId, platform, expirationDate, emTeste);

        if (anterior?.subscriptionStatus === STATUS_EM_TESTE && !emTeste) {
          const selected_plan = this.billingCycleFrom(event.product_id);
          this.analytics.track('trial_converted', { userId, plan: Plan.PRO }, { selected_plan, store: loja });
          // A receita desta pessoa entra no funil **aqui**, e não no dia em que
          // ela começou o teste — é agora que o dinheiro saiu da conta dela.
          this.analytics.track('purchase_completed', { userId, plan: Plan.PRO }, { selected_plan, store: loja });
        }
        break;
      }

      case 'PRODUCT_CHANGE':
      case 'UNCANCELLATION':
        await this.activateSubscription(userId, platform, expirationDate, emTeste);
        break;

      case 'CANCELLATION': {
        /*
         Cancelar **não** é perder o acesso.

         Até 18/08/2026 era: este `case` dividia linha com `EXPIRATION` e
         derrubava o PRO na hora. Quem cancelava no dia 20 de um mês pago até o
         dia 30 perdia dez dias que já tinha comprado — e a Apple, do lado dela,
         continuava contando esses dez dias normalmente. O app e a loja
         discordavam sobre o que a pessoa tinha.

         O que o evento diz é que a **renovação** foi desligada. Quem encerra o
         acesso é o `EXPIRATION`, que chega no fim do período — e a rede de
         segurança para o dia em que ele não chegar é `planoEfetivo`
         (`common/plano-efetivo.ts`), que compara `currentPeriodEnd` com o
         relógio em vez de confiar só na coluna.

         A exceção é reembolso: aí o dinheiro voltou, e o acesso volta junto.
        */
        const estava = await this.prisma.profile.findUnique({
          where: { id: userId },
          select: { subscriptionStatus: true },
        });
        const eraTeste = emTeste || estava?.subscriptionStatus === STATUS_EM_TESTE;

        if (event.cancel_reason === REEMBOLSO) {
          await this.deactivateSubscription(userId);
        } else {
          await this.prisma.profile.update({
            where: { id: userId },
            data: { subscriptionStatus: eraTeste ? STATUS_TESTE_CANCELADO : STATUS_CANCELADO },
          });
          this.logger.log(`Auto-renew off for user ${userId}, access until period end`);
        }

        if (eraTeste) {
          // Cancelar dentro do teste é uma decisão, e ela acontece agora — não
          // no dia em que o prazo acabar. Contar aqui é o que faz "cancelou no
          // primeiro dia" ser distinguível de "usou os sete e não voltou".
          this.analytics.track(
            'trial_ended',
            { userId, plan: Plan.PRO },
            { reason: 'canceled', store: loja },
          );
        }
        break;
      }

      case 'EXPIRATION': {
        /*
         O fim do acesso, de verdade.

         Um teste que chega aqui sem ter passado pelo cancelamento é o outro
         desfecho: a pessoa usou os sete dias e não voltou. Se ela já tinha
         cancelado, o `trial_ended` saiu naquele dia e não sai de novo — senão o
         mesmo teste apareceria duas vezes no funil, com dois motivos
         diferentes.
        */
        const estava = await this.prisma.profile.findUnique({
          where: { id: userId },
          select: { subscriptionStatus: true },
        });
        await this.deactivateSubscription(userId);

        const jaContado = estava?.subscriptionStatus === STATUS_TESTE_CANCELADO;
        if (!jaContado && (emTeste || estava?.subscriptionStatus === STATUS_EM_TESTE)) {
          this.analytics.track(
            'trial_ended',
            { userId, plan: Plan.FREE },
            { reason: 'expired', store: loja },
          );
        }
        break;
      }

      case 'BILLING_ISSUE_DETECTED':
        await this.setBillingIssue(userId);
        break;

      case 'SUBSCRIBER_ALIAS':
      case 'TRANSFER':
      case 'NON_RENEWING_PURCHASE':
        this.logger.log(`Unhandled event type: ${type}`);
        break;

      default:
        this.logger.warn(`Unknown event type: ${type}`);
    }
  }

  private async activateSubscription(
    userId: string,
    platform: string | null,
    expirationDate: Date | null,
    emTeste = false,
  ): Promise<void> {
    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        plan: Plan.PRO,
        subscriptionStatus: emTeste ? STATUS_EM_TESTE : 'active',
        subscriptionPlatform: platform,
        // Durante o teste isto é o fim do teste, e é o que o painel deve
        // mostrar: a data em que a primeira cobrança acontece.
        currentPeriodEnd: expirationDate,
      },
    });
    this.logger.log(
      emTeste ? `Started PRO trial for user ${userId}` : `Activated PRO for user ${userId}`,
    );
  }

  private async deactivateSubscription(userId: string): Promise<void> {
    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        plan: Plan.FREE,
        subscriptionStatus: 'expired',
        currentPeriodEnd: null,
      },
    });
    this.logger.log(`Deactivated PRO for user ${userId}`);
  }

  private async setBillingIssue(userId: string): Promise<void> {
    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'billing_issue',
      },
    });
    this.logger.log(`Billing issue for user ${userId}`);
  }

  private mapStoreToPlatform(store?: string): string | null {
    switch (store) {
      case 'APP_STORE':
      case 'MAC_APP_STORE':
        return 'apple';
      case 'PLAY_STORE':
        return 'google';
      default:
        return null;
    }
  }

  /**
   * Best-effort read of the billing cycle out of the store product id (e.g.
   * `quibly_pro_yearly`). RevenueCat doesn't give us a cleaner signal in the
   * webhook payload — if the naming convention ever changes, this quietly
   * falls back to `'monthly'` rather than throwing.
   */
  private billingCycleFrom(productId?: string): 'monthly' | 'yearly' | 'unknown' {
    if (!productId) return 'unknown';
    const id = productId.toLowerCase();
    if (id.includes('year') || id.includes('annual')) return 'yearly';
    if (id.includes('month')) return 'monthly';
    return 'unknown';
  }
}
