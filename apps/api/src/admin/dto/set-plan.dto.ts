import { IsIn } from 'class-validator';

/**
 * O plano, trocado à mão pelo painel.
 *
 * Existe porque não havia rota nenhuma: `PATCH /admin/users/:id/plan` devolvia
 * 404, e o painel oferecia um botão que não tinha para onde ir. Conferido contra
 * a produção em 10/08.
 *
 * ## Por que isto não é a assinatura
 *
 * Quem paga chega pela RevenueCat, e o webhook escreve `plan`,
 * `subscriptionStatus`, `subscriptionPlatform` e `currentPeriodEnd` juntos —
 * é o registro de uma cobrança real.
 *
 * Esta rota **não** finge que houve cobrança. Ela mexe em `plan` e nada mais:
 * serve para cortesia, teste e suporte. Os campos de assinatura ficam como
 * estão, e é isso que permite distinguir depois quem pagou de quem recebeu — se
 * esta rota preenchesse `subscriptionStatus`, a receita passaria a contar
 * cortesias como venda.
 */
export class SetPlanDto {
  @IsIn(['FREE', 'PRO'])
  plan!: 'FREE' | 'PRO';
}
