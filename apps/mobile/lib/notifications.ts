import { LogBox, Platform } from 'react-native';
import * as Device from 'expo-device';
import messaging from '@react-native-firebase/messaging';
import i18n from './i18n';

// Suppress the Expo Go "remote notifications removed" error during module load.
// expo-notifications calls console.error on init in Expo Go (SDK 53+).
// We temporarily patch it, load the module via require, then restore.
const _origError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('expo-notifications')) return;
  _origError(...args);
};
const Notifications = require('expo-notifications') as typeof import('expo-notifications');
console.error = _origError;

LogBox.ignoreLogs([
  'expo-notifications',
]);

const SESSION_NOTIF_PREFIX = 'session-';

// --- Configuration ---

export async function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('session', {
      name: 'Study Session',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('social', {
      name: 'Social',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

// --- Permissions ---

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// --- Push Token ---

/**
 * O token de registro do **FCM** — que é o que o servidor sabe usar.
 *
 * ## O defeito que isto conserta
 *
 * Aqui havia `Notifications.getDevicePushTokenAsync()`, que devolve o token
 * **nativo** do aparelho. No Android isso é um token FCM e funcionava; no iOS é
 * o token bruto da APNs, um hexadecimal, e o servidor entrega tudo ao
 * `firebase-admin`, que só aceita token de registro do FCM. **Push no iPhone
 * nunca entregou nada.**
 *
 * E o defeito apagava as próprias pegadas: o Firebase recusava com "not a valid
 * FCM registration token", e o nosso `catch` reconhece essa mensagem, conclui
 * que o token é inválido e **apaga a linha do banco**. Então o sintoma não era
 * erro se acumulando — era a tabela ficando vazia. Quem olhasse concluiria "esse
 * usuário não tem token", nunca "esse token está sendo recusado".
 *
 * `messaging().getToken()` devolve token FCM nas duas plataformas, então o
 * servidor não muda e o Android segue igual.
 *
 * ## Por que a permissão vem antes
 *
 * No iOS o FCM só consegue um token depois de a APNs ter dado o dela, e a APNs
 * só dá com a permissão concedida. Chamado antes, devolve erro — por isso quem
 * chama pergunta primeiro (ver `app/_layout.tsx`).
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  try {
    return await messaging().getToken();
  } catch (err) {
    console.warn('Failed to get device push token:', err);
    return null;
  }
}

/**
 * Avisa quando o FCM troca o token.
 *
 * Ele troca sozinho — restauração de backup, reinstalação, limpeza de dados do
 * app. O token antigo para de entregar em silêncio, e sem isto a pessoa some das
 * notificações sem nada indicar por quê.
 */
export function onPushTokenRefresh(aoTrocar: (token: string) => void): () => void {
  return messaging().onTokenRefresh(aoTrocar);
}

// --- Local Notification Scheduling ---

export async function schedulePhaseEndNotification(
  remainingSeconds: number,
  currentPhase: 'work' | 'break',
) {
  await cancelNotificationsByPrefix(`${SESSION_NOTIF_PREFIX}phase`);

  if (remainingSeconds <= 0) return;

  const title =
    currentPhase === 'work'
      ? i18n.t('notifications:phaseEnd.workDoneTitle')
      : i18n.t('notifications:phaseEnd.breakDoneTitle');
  const body =
    currentPhase === 'work'
      ? i18n.t('notifications:phaseEnd.workDoneBody')
      : i18n.t('notifications:phaseEnd.breakDoneBody');

  await Notifications.scheduleNotificationAsync({
    identifier: `${SESSION_NOTIF_PREFIX}phase-end`,
    content: {
      title,
      body,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: 'session' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: remainingSeconds,
      repeats: false,
    },
  });
}

export async function scheduleProofCheckNotification(
  secondsUntilCheck: number,
) {
  if (secondsUntilCheck <= 0) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `${SESSION_NOTIF_PREFIX}proof-${Date.now()}`,
    content: {
      title: i18n.t('notifications:proofCheck.title'),
      body: i18n.t('notifications:proofCheck.body'),
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: 'session' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilCheck,
      repeats: false,
    },
  });
}

export async function cancelSessionNotifications() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of all) {
    if (notif.identifier.startsWith(SESSION_NOTIF_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

export function addNotificationResponseListener(
  callback: (response: any) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

async function cancelNotificationsByPrefix(prefix: string) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of all) {
    if (notif.identifier.startsWith(prefix)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}
