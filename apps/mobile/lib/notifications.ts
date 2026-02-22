import { LogBox, Platform } from 'react-native';
import * as Device from 'expo-device';
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

export async function getDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  try {
    const { data } = await Notifications.getDevicePushTokenAsync();
    return data;
  } catch (err) {
    console.warn('Failed to get device push token:', err);
    return null;
  }
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
