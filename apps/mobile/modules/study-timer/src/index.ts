import { NativeModule, requireNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * The live study timer surface: an Android foreground service, an iOS Live
 * Activity. One API, because callers should not have to know which.
 *
 * They are not equivalent, and the difference is worth stating plainly:
 *
 * - **Android** — the foreground service keeps the process alive, which keeps
 *   the JS heartbeat beating. It genuinely protects the session.
 * - **iOS** — nothing can keep an app running indefinitely in the background.
 *   The Live Activity is a *display*, with a timer the system advances on its
 *   own. It shows the session and offers pause/end; it does not sustain it.
 *
 * On both platforms, what actually protects the user's study time is the
 * server: it measures the duration, and if the heartbeat stops it credits the
 * session up to the last beat rather than discarding it
 * (docs/API-SESSIONS.md §5). This module improves visibility and, on Android,
 * longevity. It is not the safety net.
 */

export type NotificationAction = 'pause' | 'resume' | 'end';

export type StudyTimerEvents = {
  onNotificationAction: (event: { action: NotificationAction }) => void;
  // Expo's `NativeModule<T>` constrains T to an index-signature-bearing map.
  // A plain interface has no index signature, so it fails the constraint; a
  // type alias with one satisfies it without losing the specific event above.
  [key: string]: (...args: any[]) => void;
};

declare class StudyTimerModuleType extends NativeModule<StudyTimerEvents> {
  start(
    subject: string,
    elapsedSeconds: number,
    isRunning: boolean,
    phaseRemainingSeconds: number,
    phaseTotalSeconds: number,
    phaseLabel: string,
  ): Promise<void>;
  update(
    subject: string,
    elapsedSeconds: number,
    isRunning: boolean,
    phaseRemainingSeconds: number,
    phaseTotalSeconds: number,
    phaseLabel: string,
  ): Promise<void>;
  stop(): Promise<void>;
  /** iOS: guarda no App Group o que o App Intent da extensão precisa. */
  setActionContext(sessionId: string, token: string, apiBaseUrl: string): void;
  clearActionContext(): void;
  isBatteryOptimizationIgnored(): boolean;
  openBatterySettings(): Promise<void>;
  getManufacturer(): string;
  isRunning(): boolean;
}

/**
 * Resolved lazily and tolerantly. The module is absent in Expo Go and in any
 * build made before this native code landed; a study session must still start
 * in those, just without the lock-screen surface.
 */
function resolve(): StudyTimerModuleType | null {
  if (Platform.OS === 'web') return null;
  try {
    return requireNativeModule<StudyTimerModuleType>('StudyTimer');
  } catch {
    return null;
  }
}

const native = resolve();

/** Whether the native surface is available in this build. */
export const isAvailable = native !== null;

export default native;
