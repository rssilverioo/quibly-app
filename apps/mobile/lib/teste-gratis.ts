/**
 * O teste grátis, lido do produto que a loja entregou.
 *
 * ## Por que isto não é uma constante `7`
 *
 * Quem decide a duração do teste é a **loja**, não o app. O período é um campo
 * da oferta introdutória no App Store Connect e da oferta do plano base na Play
 * Console, e mudar de 7 para 14 dias é uma edição lá — sem build novo.
 *
 * Um `7` escrito aqui seria a mesma promessa quebrada que o `17%` de desconto
 * fixo era antes de `economiaAnual`: no dia em que alguém mexer na oferta, a
 * tela onde a pessoa decide pagar passa a mentir, e ninguém descobre porque o
 * código continua compilando.
 *
 * ## Por que é um módulo separado de `services/iap.ts`
 *
 * `vitest.config.ts` só roda `lib/**` e exige que nada ali importe React
 * Native — e `services/iap.ts` importa o SDK, que é nativo. As regras deste
 * arquivo são as que mais precisam de teste (elegibilidade, conversão de
 * período, oferta paga que não é grátis), então elas moram onde o teste
 * alcança.
 *
 * Os tipos abaixo são **estruturais de propósito**: descrevem só os campos que
 * usamos do `PurchasesStoreProduct`, sem importar o SDK. O produto de verdade
 * satisfaz a forma; os testes constroem objetos literais.
 */

/** O que `PurchasesStoreProduct` expõe do período introdutório — o subconjunto
 *  que nos interessa. No iOS vem de `introPrice`; no Android o SDK também o
 *  preenche a partir da fase gratuita, mas `defaultOption` é a fonte fiel. */
export interface OfertaIntrodutoria {
  /** `0` num teste grátis. Uma oferta introdutória **paga** (meio preço no
   *  primeiro mês, por exemplo) chega por aqui com preço > 0 — e não é teste. */
  readonly price: number;
  /** `DAY` | `WEEK` | `MONTH` | `YEAR`. */
  readonly periodUnit: string;
  readonly periodNumberOfUnits: number;
}

/** A fase gratuita do plano base, no Android. */
export interface FaseDeCobranca {
  readonly billingPeriod: { readonly unit: string; readonly value: number };
}

export interface ProdutoDaLoja {
  readonly introPrice?: OfertaIntrodutoria | null;
  readonly defaultOption?: { readonly freePhase?: FaseDeCobranca | null } | null;
}

/**
 * Dias por unidade de período.
 *
 * `MONTH` e `YEAR` são aproximações — um mês tem 28 a 31 dias — e estão aqui
 * porque a loja **permite** ofertas de 1 mês e 1 ano. Se um dia vendermos um
 * teste medido em meses, a cópia da tela precisa de uma chave por unidade
 * ("1 mês grátis"), e não de "30 dias grátis". Hoje o teste é de 7 dias, a
 * conversão de `WEEK` e `DAY` é exata, e a aproximação não chega à tela.
 */
const DIAS_POR_UNIDADE: Record<string, number> = {
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
};

/**
 * Quantos dias de teste grátis este produto oferece, ou `null` se nenhum.
 *
 * Duas fontes, na ordem: `introPrice` (que o iOS preenche e o Android espelha)
 * e a fase gratuita de `defaultOption` (a fonte de verdade do Android, e a
 * única que existe quando a oferta é um `offerId` do plano base).
 *
 * `price === 0` não é detalhe: a Apple e o Google usam o mesmo campo para
 * "primeiro mês pela metade", e chamar isso de grátis na tela de assinatura é
 * cobrança inesperada — a reclamação mais cara que existe.
 */
export function diasDeTesteGratis(produto: ProdutoDaLoja | null | undefined): number | null {
  if (!produto) return null;

  const intro = produto.introPrice;
  if (intro && intro.price === 0) {
    const dias = emDias(intro.periodUnit, intro.periodNumberOfUnits);
    if (dias) return dias;
  }

  const fase = produto.defaultOption?.freePhase;
  if (fase) {
    const dias = emDias(fase.billingPeriod.unit, fase.billingPeriod.value);
    if (dias) return dias;
  }

  return null;
}

function emDias(unidade: string, quantidade: number): number | null {
  const porUnidade = DIAS_POR_UNIDADE[unidade?.toUpperCase?.() ?? ''];
  if (!porUnidade || !Number.isFinite(quantidade) || quantidade <= 0) return null;
  return porUnidade * quantidade;
}

/** O que o SDK sabe sobre esta pessoa já ter usado um teste antes. */
export type Elegibilidade = 'elegivel' | 'inelegivel' | 'desconhecida';

/**
 * Traduz o enum numérico do RevenueCat.
 *
 * `0` UNKNOWN · `1` INELIGIBLE · `2` ELIGIBLE · `3` NO_INTRO_OFFER_EXISTS.
 *
 * `3` vira `'inelegivel'` e não `'desconhecida'`: "não existe oferta" é uma
 * resposta definitiva, e tratá-la como dúvida faria a tela prometer um teste
 * que o catálogo não tem.
 */
export function elegibilidadeDoStatus(status: number | undefined): Elegibilidade {
  switch (status) {
    case 2:
      return 'elegivel';
    case 1:
    case 3:
      return 'inelegivel';
    default:
      return 'desconhecida';
  }
}

/**
 * Se a tela pode **prometer** o teste grátis.
 *
 * A regra é assimétrica entre as lojas, e não por descuido:
 *
 * - **iOS** exige `'elegivel'`. `checkTrialOrIntroductoryPriceEligibility`
 *   responde de verdade lá, e a própria documentação do RevenueCat manda
 *   mostrar o preço cheio quando a resposta é desconhecida — "to not create a
 *   misleading situation". Quem já usou os 7 dias e lê "7 dias grátis" toca o
 *   botão e é cobrado na hora. É a pior falha possível nesta tela.
 *
 * - **Android** aceita `'desconhecida'`, porque lá a API **sempre** devolve
 *   UNKNOWN — aplicar a regra do iOS esconderia o teste de todo mundo. E não
 *   precisa: o Google Play só inclui nos detalhes do produto as ofertas para as
 *   quais aquela conta é elegível. A presença da fase gratuita já **é** a
 *   resposta de elegibilidade.
 *
 * `'inelegivel'` fecha a porta nas duas, para o dia em que o SDK do Android
 * passar a responder.
 */
export function podePrometerTeste(args: {
  dias: number | null;
  elegibilidade: Elegibilidade;
  plataforma: string;
}): boolean {
  const { dias, elegibilidade, plataforma } = args;
  if (!dias || dias <= 0) return false;
  if (plataforma === 'ios') return elegibilidade === 'elegivel';
  return elegibilidade !== 'inelegivel';
}
