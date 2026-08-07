import { Platform } from 'react-native';
import StudyTimer, {
  isAvailable,
  type NotificationAction,
} from '../modules/study-timer/src';
import { captureException } from '../lib/sentry';

/**
 * Thin, failure-tolerant wrapper around the native live-timer surface.
 *
 * Every call here is best-effort and swallows its errors. That is deliberate:
 * the foreground service and the Live Activity are conveniences layered on top
 * of a session that is already safe on the server. A user must never fail to
 * start studying because a notification channel misbehaved.
 *
 * ## Tolerante não é o mesmo que mudo
 *
 * A versão original deste arquivo abria cada função com `if (!StudyTimer)
 * return` e fechava cada `try` com um `catch {}` vazio. A intenção estava
 * certa; o efeito colateral custou caro. O módulo nativo **não existia no
 * iOS** — faltava o `StudyTimer.podspec`, então o autolinking da Expo descartava
 * o módulo em silêncio e `requireNativeModule` lançava. Cada chamada retornava
 * na primeira linha e a Live Activity nunca chegou a ser tentada uma vez
 * sequer. Sem log, sem crash, sem teste que pegasse: a falha era invisível por
 * construção, e assim ficou até alguém reparar que o cronômetro não aparecia na
 * tela de bloqueio.
 *
 * A lição não é parar de engolir o erro — é que engolir só é aceitável se
 * alguém for avisado. Estas notas vão para o log do dispositivo (visível em
 * `xcrun simctl spawn booted log stream` e no console do Xcode) e para o Sentry
 * quando houver DSN. Nenhuma delas chega ao usuário: ele continua estudando
 * sem saber que o mostrador falhou, que era o objetivo desde o começo.
 */

/**
 * Cada condição é reportada uma vez por execução do app.
 *
 * `updateLiveTimer` é chamado a cada heartbeat, de 30 em 30 segundos. Um log
 * por chamada afogaria o console em minutos e treinaria todo mundo a ignorá-lo
 * — que é como um log deixa de ser um log. Uma linha por problema distinto é
 * o suficiente para diagnosticar; a segunda ocorrência não acrescenta nada.
 */
const reported = new Set<string>();

function note(key: string, message: string, error?: unknown): void {
  if (reported.has(key)) return;
  reported.add(key);

  const detail = error instanceof Error ? `: ${error.message}` : '';
  // `warn`, não `error`: nada aqui compromete a sessão, que é medida no
  // servidor. Elevar para erro faria um mostrador ausente competir com falhas
  // que de fato custam tempo de estudo ao usuário.
  console.warn(`[study-timer] ${message}${detail}`);
  if (error !== undefined) captureException(error, { scope: 'study-timer', op: key });
}

/**
 * O módulo nativo ausente é um fato só, não um por função.
 *
 * Reportado uma vez, no primeiro uso — e não no import, porque em Expo Go a
 * ausência é esperada e um aviso no boot seria ruído em toda sessão de
 * desenvolvimento.
 */
function missing(op: string): boolean {
  if (StudyTimer) return false;
  note(
    'unavailable',
    `módulo nativo indisponível (op: ${op}). ` +
      'Esperado no Expo Go e na web; em dev build significa que o autolinking ' +
      'não encontrou o módulo — confira modules/study-timer/ios/StudyTimer.podspec.',
  );
  return true;
}

/**
 * O bloco atual da sessão, para a Live Activity contar para baixo como a tela.
 *
 * `totalSeconds === 0` é cronômetro livre: sem bloco, sem regressiva, sem
 * barra. O rótulo vem traduzido do app porque a extensão de widget não carrega
 * i18n — mandar a chave `session.phase.work` renderizaria a chave.
 */
export interface FaseDaSessao {
  remainingSeconds: number;
  totalSeconds: number;
  label: string;
}

const SEM_FASE: FaseDaSessao = { remainingSeconds: 0, totalSeconds: 0, label: '' };

const arredondar = (fase: FaseDaSessao): [number, number, string] => [
  Math.max(0, Math.floor(fase.remainingSeconds)),
  Math.max(0, Math.floor(fase.totalSeconds)),
  fase.label,
];

export async function startLiveTimer(
  subject: string,
  elapsedSeconds: number,
  isRunning: boolean,
  fase: FaseDaSessao = SEM_FASE,
): Promise<void> {
  if (missing('start')) return;
  try {
    await StudyTimer!.start(
      subject, Math.max(0, Math.floor(elapsedSeconds)), isRunning, ...arredondar(fase),
    );
  } catch (error) {
    note('start', 'falha ao iniciar o cronômetro externo', error);
  }
}

export async function updateLiveTimer(
  subject: string,
  elapsedSeconds: number,
  isRunning: boolean,
  fase: FaseDaSessao = SEM_FASE,
): Promise<void> {
  if (missing('update')) return;
  try {
    await StudyTimer!.update(
      subject, Math.max(0, Math.floor(elapsedSeconds)), isRunning, ...arredondar(fase),
    );
  } catch (error) {
    note('update', 'falha ao atualizar o cronômetro externo', error);
  }
}

/**
 * Entrega à extensão o que o botão da Live Activity precisa para agir sozinho.
 *
 * Só iOS, e só faz sentido com `SESSION_ACTION_SECRET` no servidor — sem ele a
 * API devolve `token` nulo e os botões seguem pelo deep link, que abre o app.
 */
export function setLiveActionContext(
  sessionId: string,
  token: string | null | undefined,
  apiBaseUrl: string,
): void {
  if (missing('setActionContext') || !token) return;
  try {
    StudyTimer!.setActionContext(sessionId, token, apiBaseUrl);
  } catch (error) {
    note('setActionContext', 'não deu para compartilhar o contexto da sessão', error);
  }
}

/** Apaga a credencial quando a sessão acaba. */
export function clearLiveActionContext(): void {
  if (missing('clearActionContext')) return;
  try {
    StudyTimer!.clearActionContext();
  } catch (error) {
    note('clearActionContext', 'não deu para limpar o contexto da sessão', error);
  }
}

export async function stopLiveTimer(): Promise<void> {
  if (missing('stop')) return;
  try {
    await StudyTimer!.stop();
  } catch (error) {
    note('stop', 'falha ao encerrar o cronômetro externo', error);
  }
}

/**
 * Subscribe to pause/resume/end tapped on the notification or Live Activity.
 * Returns an unsubscribe function.
 */
export function onLiveTimerAction(
  handler: (action: NotificationAction) => void,
): () => void {
  if (missing('addListener')) return () => {};
  const sub = StudyTimer!.addListener('onNotificationAction', ({ action }) => handler(action));
  return () => sub.remove();
}

/**
 * Manufacturers whose battery managers stop foreground services regardless of
 * the documented contract.
 *
 * This list is empirical, not from any API — there is no way to ask Android
 * "will your OEM kill me". Xiaomi/Redmi/Poco (MIUI) and Huawei/Honor are the
 * worst offenders and require the user to whitelist the app by hand; Samsung
 * and Oppo/Vivo/Realme are aggressive but usually survive once the battery
 * exemption is granted.
 *
 * Getting this wrong is cheap in one direction and expensive in the other:
 * a needless prompt is mild friction, while silence on a Xiaomi means the user
 * loses hours of study time and blames the app. So the list errs inclusive.
 */
const AGGRESSIVE_OEMS = [
  'xiaomi', 'redmi', 'poco',
  'huawei', 'honor',
  'oppo', 'vivo', 'realme', 'oneplus',
  'samsung',
  'meizu', 'asus', 'lenovo',
];

export interface BatteryWarning {
  manufacturer: string;
  /** True when this OEM is known to kill services even with the exemption. */
  isAggressive: boolean;
}

/**
 * Whether the user should be told that the system may stop their timer.
 *
 * Android only, and only when the exemption is actually missing — nagging
 * someone who already granted it is exactly the kind of thing that gets an app
 * uninstalled.
 */
export function getBatteryWarning(): BatteryWarning | null {
  if (Platform.OS !== 'android' || !StudyTimer) return null;

  try {
    if (StudyTimer.isBatteryOptimizationIgnored()) return null;
    const manufacturer = StudyTimer.getManufacturer();
    return {
      manufacturer,
      isAggressive: AGGRESSIVE_OEMS.includes(manufacturer.toLowerCase()),
    };
  } catch (error) {
    // Falhar aqui significa não pedir a isenção de bateria, e num Xiaomi isso
    // custa horas de estudo ao usuário — vale saber que aconteceu.
    note('batteryWarning', 'não foi possível checar a otimização de bateria', error);
    return null;
  }
}

export async function openBatterySettings(): Promise<void> {
  if (missing('openBatterySettings')) return;
  try {
    await StudyTimer!.openBatterySettings();
  } catch (error) {
    note('openBatterySettings', 'não foi possível abrir os ajustes de bateria', error);
  }
}

export { isAvailable as isLiveTimerAvailable };
export type { NotificationAction };
