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
 * **Compra dentro do app: desligada.** Decisão do dono do produto em
 * 06/08/2026 — *"vamos desativar opção de compra dentro do app por enquanto,
 * futuramente iremos ajustar"*.
 *
 * O produto não perde nada hoje: todo entitlement já nasce em `Infinity`
 * (`ROADMAP §Fase 0` — "permite lançar grátis e monetizar sem refactor"), então
 * o paywall não guardava nenhuma porta. O que ele fazia era prometer uma compra
 * que, no Android, nem podia acontecer: a chave do RevenueCat é o placeholder
 * `goog_YOUR_REVENUECAT_ANDROID_KEY`.
 *
 * Some também um risco de review: uma tela de assinatura que carrega vazia é
 * candidata a *Guideline 2.1 — App Completeness*.
 *
 * **Para religar, mude esta constante para `true`.** Nada foi apagado: a tela,
 * o hook e as funções de compra continuam inteiros, e `revenueCatConfigError`
 * abaixo é o que impede que a religação aconteça com chave de mentira.
 */
export const COMPRAS_NO_APP_ATIVAS = false;

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
