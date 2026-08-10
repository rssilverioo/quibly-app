import Purchases, {
  type PurchasesOfferings,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';
import { captureException } from '../lib/sentry';

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
 * **O Android continua sem chave.** `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`
 * ainda é `goog_YOUR_REVENUECAT_ANDROID_KEY` em todos os perfis, e é por isso
 * que `revenueCatConfigError` abaixo não foi tocado: ele detecta o placeholder
 * e faz a tela dizer o que houve, em vez de mostrar o vazio que mente. Ligar
 * aqui não liga a compra no Android — só para de escondê-la no iOS, onde ela
 * funciona.
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
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (err) {
    console.warn('[RevenueCat] getOfferings error:', err);
    captureException(err, { where: 'RevenueCat.getOfferings' });
    return null;
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
