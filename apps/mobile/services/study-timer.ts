import { Platform } from 'react-native';
import StudyTimer, {
  isAvailable,
  type NotificationAction,
} from '../modules/study-timer/src';

/**
 * Thin, failure-tolerant wrapper around the native live-timer surface.
 *
 * Every call here is best-effort and swallows its errors. That is deliberate:
 * the foreground service and the Live Activity are conveniences layered on top
 * of a session that is already safe on the server. A user must never fail to
 * start studying because a notification channel misbehaved.
 */

export async function startLiveTimer(
  subject: string,
  elapsedSeconds: number,
  isRunning: boolean,
): Promise<void> {
  if (!StudyTimer) return;
  try {
    await StudyTimer.start(subject, Math.max(0, Math.floor(elapsedSeconds)), isRunning);
  } catch {
    /* best effort — see the note above */
  }
}

export async function updateLiveTimer(
  subject: string,
  elapsedSeconds: number,
  isRunning: boolean,
): Promise<void> {
  if (!StudyTimer) return;
  try {
    await StudyTimer.update(subject, Math.max(0, Math.floor(elapsedSeconds)), isRunning);
  } catch {
    /* best effort */
  }
}

export async function stopLiveTimer(): Promise<void> {
  if (!StudyTimer) return;
  try {
    await StudyTimer.stop();
  } catch {
    /* best effort */
  }
}

/**
 * Subscribe to pause/resume/end tapped on the notification or Live Activity.
 * Returns an unsubscribe function.
 */
export function onLiveTimerAction(
  handler: (action: NotificationAction) => void,
): () => void {
  if (!StudyTimer) return () => {};
  const sub = StudyTimer.addListener('onNotificationAction', ({ action }) => handler(action));
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
  } catch {
    return null;
  }
}

export async function openBatterySettings(): Promise<void> {
  if (!StudyTimer) return;
  try {
    await StudyTimer.openBatterySettings();
  } catch {
    /* best effort */
  }
}

export { isAvailable as isLiveTimerAvailable };
export type { NotificationAction };
