import Purchases, {
  type PurchasesOfferings,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';
import { captureException } from '../lib/sentry';
import {
  diasDeTesteGratis,
  elegibilidadeDoStatus,
  podePrometerTeste,
  type Elegibilidade,
} from '../lib/teste-gratis';

export { diasDeTesteGratis, podePrometerTeste, type Elegibilidade };

const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';
const ENTITLEMENT_ID = 'pro';

export type { PurchasesPackage, PurchasesOfferings };

/**
 * **Compra dentro do app: ligada** desde 09/08/2026.
 *
 * ~~"Desligada em 06/08 — o paywall prometia uma compra que no Android nem
 * podia acontecer, e uma tela de assinatura que carrega vazia é candidata a
 * Guideline 2.1."~~ As duas razões caíram, e por motivos diferentes.
 *
 * O paywall passou a **guardar uma porta de verdade**: o plano grátis vale três
 * salas próprias (`FREE_ROOMS` na API), e a quarta abre a folha do Pro. Antes
 * todo entitlement nascia em `Infinity` e não havia o que vender.
 *
 * E o catálogo existe: entitlement `pro`, produtos `com.quibly.app.pro.monthly`
 * e `.yearly` aprovados na App Store, offering `default` com `$rc_monthly` e
 * `$rc_annual` — que é exatamente o que `useIAP` procura. A tela carrega preço
 * real, não vazio.
 *
 * ~~"O Android continua sem chave."~~ Deixou de ser verdade em 14/08: o app da
 * Play Store foi criado no RevenueCat, com a service account
 * `revenuecat-play@quibly-70e89` validada, e a chave `goog_` entrou nos três
 * perfis.
 *
 * `revenueCatConfigError` fica de pé mesmo assim. Ele não existia por causa do
 * Android — existe porque **build sem chave é indistinguível de build sem
 * rede** na tela de planos, e vazio mente: parece carregando. Vale para
 * qualquer plataforma, hoje e depois.
 *
 * ~~"O que ainda falta no Android não é chave, é catálogo: as assinaturas
 * precisam existir na Play Console."~~ Elas existem — verificado no painel em
 * 18/08/2026: `com.quibly.app.pro.monthly` e `com.quibly.app.pro.yearly`, cada
 * uma com um plano básico ativo em 174 países.
 *
 * O que continua **não verificado** é o outro elo: se esses produtos estão
 * anexados aos pacotes `$rc_monthly` e `$rc_annual` da offering `default` no
 * RevenueCat. Sem isso a oferta chega vazia com a configuração toda correta dos
 * dois lados — e é o mesmo modo de falha silencioso de sempre, porque a tela
 * não sabe distinguir "não anexado" de "sem rede".
 */
export const COMPRAS_NO_APP_ATIVAS = true;

/**
 * Uma chave que não é chave — vazia ou o placeholder que veio do `eas.json`.
 *
 * `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` está literalmente como
 * `goog_YOUR_REVENUECAT_ANDROID_KEY` em todos os perfis de build. Configurar o
 * RevenueCat com isso não estoura: ele aceita, e só falha depois, no
 * `getOfferings` — que tem `catch` e devolve `null`. A tela de preços então
 * mostra o estado vazio, indistinguível de "ainda carregando" ou "sem produtos
 * nesta região".
 *
 * Ou seja: no Android o paywall está morto e **não há como saber pela tela**.
 * É o mesmo modo de falha que escondeu o feed vazio por semanas e a Live
 * Activity por meses. Aqui ele custa dinheiro diretamente.
 */
const ehPlaceholder = (chave: string) =>
  chave.length === 0 || /_YOUR_|YOUR_REVENUECAT/i.test(chave);

/** A chave da plataforma em que este bundle roda. */
function chaveDaPlataforma(): { chave: string; plataforma: string } {
  // `__DEV__` continua iOS-first: as builds de desenvolvimento são de iOS, e
  // trocar isso faria o dev de Android configurar com a chave errada.
  if (__DEV__) return { chave: REVENUECAT_API_KEY_IOS, plataforma: 'ios (dev)' };
  const os = require('react-native').Platform.OS as string;
  return os === 'ios'
    ? { chave: REVENUECAT_API_KEY_IOS, plataforma: 'ios' }
    : { chave: REVENUECAT_API_KEY_ANDROID, plataforma: 'android' };
}

/**
 * Não-nulo quando o bundle foi construído sem uma chave de verdade. Quem desenha
 * a tela de preços deve mostrar isto em vez do estado vazio — vazio mente.
 */
export function revenueCatConfigError(): string | null {
  const { chave, plataforma } = chaveDaPlataforma();
  if (!ehPlaceholder(chave)) return null;
  return (
    `RevenueCat sem chave válida para ${plataforma}. ` +
    'Compras e restauração não funcionam neste build. ' +
    'Defina EXPO_PUBLIC_REVENUECAT_API_KEY_* nos perfis de eas.json.'
  );
}

export async function initRevenueCat(userId: string): Promise<void> {
  if (!COMPRAS_NO_APP_ATIVAS) return;

  const erro = revenueCatConfigError();
  if (erro) {
    // Não configurar é melhor que configurar com lixo: o SDK ficaria num estado
    // "pronto" que só falha na hora da compra, e o log sairia longe daqui.
    console.warn('[RevenueCat]', erro);
    captureException(new Error(erro), { where: 'RevenueCat.configure' });
    return;
  }

  Purchases.configure({ apiKey: chaveDaPlataforma().chave, appUserID: userId });

  /*
   Aquece a oferta agora, sem esperar por ela.

   É o que faz `diasDeTesteEmCache()` ter resposta quando a folha do Pro abrir —
   e ela abre no meio de criar uma sala, sem aviso. O SDK já guarda as ofertas
   por conta própria, então isto é uma ida à rede só na primeira vez por sessão.

   Sem `await` e sem `catch` de verdade: se falhar, a folha usa a cópia neutra e
   a tela de preços tenta de novo por conta própria. `getOfferings` já reporta.
  */
  void getOfferings();
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();
    lembrarDoTeste(offerings);
    return offerings;
  } catch (err) {
    console.warn('[RevenueCat] getOfferings error:', err);
    captureException(err, { where: 'RevenueCat.getOfferings' });
    return null;
  }
}

/**
 * Quantos dias de teste a última oferta carregada tinha, ou `null` enquanto
 * nada foi carregado.
 *
 * Existe para a **folha do Pro** poder dizer "comece 7 dias grátis" no botão.
 * Ela abre no instante em que a pessoa bate no limite de salas — o momento de
 * maior intenção do app inteiro — e não tem como esperar uma ida à rede ali sem
 * o botão piscar de texto na mão de quem já está lendo.
 *
 * `null` enquanto não se sabe, e a folha então usa a cópia neutra. **Nunca
 * promete por otimismo**: o dia em que a oferta perder o teste, quem não
 * carregou nada lê o texto que continua verdadeiro.
 */
let testeConhecido: number | null = null;

/** @see testeConhecido */
export function diasDeTesteEmCache(): number | null {
  return testeConhecido;
}

function lembrarDoTeste(offerings: PurchasesOfferings | null): void {
  const atual = offerings?.current;
  if (!atual) return;
  // O mensal é a referência: é o pacote que a tela abre selecionado, e as duas
  // ofertas carregam o mesmo teste na prática. Se um dia divergirem, quem
  // decide é a tela de preços, que lê o produto de cada pacote.
  testeConhecido =
    diasDeTesteGratis(atual.monthly?.product) ?? diasDeTesteGratis(atual.annual?.product);
}

/**
 * Se esta conta ainda tem direito ao teste grátis de cada produto.
 *
 * **Só o iOS responde.** No Android a API devolve UNKNOWN sempre, e é por isso
 * que `podePrometerTeste` trata dúvida de maneira diferente em cada loja — o
 * porquê está lá, em `lib/teste-gratis.ts`.
 *
 * Falha para `'desconhecida'` em vez de estourar: no iOS isso fecha a promessa
 * do teste e a tela mostra o preço cheio, que é o lado seguro de errar. Uma
 * exceção aqui derrubaria o carregamento de preços inteiro por causa de um
 * dado que só decide uma linha de texto.
 */
export async function elegibilidadeDeTeste(
  productIds: string[],
): Promise<Record<string, Elegibilidade>> {
  if (productIds.length === 0) return {};
  try {
    const mapa = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
    return Object.fromEntries(
      productIds.map((id) => [id, elegibilidadeDoStatus(mapa[id]?.status)]),
    );
  } catch (err) {
    console.warn('[RevenueCat] checkTrialOrIntroductoryPriceEligibility error:', err);
    return Object.fromEntries(productIds.map((id) => [id, 'desconhecida' as const]));
  }
}

/**
 * A vitrine da App Store em que este aparelho está.
 *
 * **É a variável que faltava.** Em 10/08 o telemetria do build 62 mostrou o
 * aparelho recebendo `9.99 USD` e `59.99 USD` para os produtos certos, com o
 * preço já corrigido — enquanto a folha de compra da Apple, no mesmo aparelho,
 * cobrava em real. Preço novo e produto certo descartam cache defasado e
 * catálogo trocado; sobra a vitrine.
 *
 * `priceString` é formatado na moeda da vitrine que o StoreKit entregou ao
 * SDK. Se ela diverge da vitrine que cobra, os dois números discordam e nenhum
 * dos dois está "errado" — eles são de lojas diferentes. Sem registrar o país,
 * a investigação fica escolhendo entre teorias que o dado não separa.
 *
 * `null` quando o SDK não sabe: no Android sem chave, antes de configurar, ou
 * em plataforma sem loja. Não é erro — é ausência, e vai registrada como tal.
 */
export async function paisDaVitrine(): Promise<string | null> {
  try {
    const vitrine = await Purchases.getStorefront();
    return vitrine?.countryCode ?? null;
  } catch (err) {
    // Diagnóstico não derruba tela. Se a vitrine não vier, o resto do
    // carregamento de preços segue igual.
    console.warn('[RevenueCat] getStorefront error:', err);
    return null;
  }
}

export async function purchase(
  pkg: PurchasesPackage,
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<{
  restored: boolean;
}> {
  const customerInfo = await Purchases.restorePurchases();
  const isActive = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  return { restored: isActive };
}

export function checkEntitlement(customerInfo: CustomerInfo): boolean {
  return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}
