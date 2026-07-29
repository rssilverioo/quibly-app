import { useEffect, useRef } from 'react';
import { LogBox, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { useSessionStore } from '../stores/session.store';
import { useTheme, hydrateTheme } from '../theme';
import {
  configureNotifications,
  requestNotificationPermissions,
  getDevicePushToken,
  addNotificationResponseListener,
} from '../lib/notifications';
import { registerPushToken } from '../services/notifications';
import { initRevenueCat } from '../services/iap';
import '../lib/i18n';
import { initAnalytics } from '../lib/analytics';
import { initSentry, captureException } from '../lib/sentry';

// Raised by expo-router's own ErrorBoundary/Toast/Sitemap views, which still
// use React Native's SafeAreaView. Every screen we own already imports it from
// react-native-safe-area-context, so there is nothing here to act on — and a
// permanent warning trains you to ignore the ones that matter.
// Scoped to this single message on purpose: never ignoreAllLogs.
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);

SplashScreen.preventAutoHideAsync();

// As early as possible, before anything else has a chance to throw. No-ops
// entirely without EXPO_PUBLIC_SENTRY_DSN — see lib/sentry.ts.
initSentry();

function extractJoinPath(url: string | null): string | null {
  if (!url) return null;

  // Universal Links / App Links: https://tryquibly.com/join/{code}
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'tryquibly.com' && parsed.pathname.startsWith('/join/')) {
      const code = parsed.pathname.replace('/join/', '');
      if (code) return `/league/join/${code}`;
    }
  } catch {}

  // Custom scheme fallback: quibly://league/join/{code}
  const linked = Linking.parse(url);
  if (linked.path?.startsWith('league/join/')) {
    return `/${linked.path}`;
  }

  return null;
}

function RootLayoutNav() {
  const { isAuthenticated, isLoading, user, profile } = useAuth();
  const { c } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const pendingDeepLink = useRef<string | null>(null);
  const pushTokenRegistered = useRef(false);

  // Initialize notifications
  useEffect(() => {
    configureNotifications();
  }, []);

  // Pick a live session back up on launch.
  //
  // This is where "the timer survived the app being killed" becomes visible.
  // The server kept measuring the whole time; all the app has to do is ask what
  // is live and adopt it, elapsed count and all. Without this the session would
  // still be safe server-side, but the user would reopen the app to an empty
  // home screen and reasonably conclude it was lost.
  const sessionRestored = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || sessionRestored.current) return;
    sessionRestored.current = true;

    useSessionStore
      .getState()
      .restoreFromServer()
      .catch((err) => {
        // A failure here costs the user nothing — the session stays open on the
        // server and the sweeper will settle it — so never block startup on it.
        console.warn('Failed to restore active session:', err);
        captureException(err, { where: 'restoreActiveSession' });
      });
  }, [isAuthenticated]);

  // Initialize RevenueCat when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;
    initRevenueCat(user.uid).catch((err) => {
      console.warn('Failed to init RevenueCat:', err);
      captureException(err, { where: 'initRevenueCat' });
    });
  }, [isAuthenticated, user?.uid]);

  // Register FCM push token when authenticated
  useEffect(() => {
    if (!isAuthenticated || pushTokenRegistered.current) return;

    (async () => {
      const granted = await requestNotificationPermissions();
      if (!granted) return;

      const fcmToken = await getDevicePushToken();
      if (!fcmToken) return;

      try {
        await registerPushToken(fcmToken, Platform.OS);
        pushTokenRegistered.current = true;
      } catch (err) {
        console.warn('Failed to register push token:', err);
        captureException(err, { where: 'registerPushToken' });
      }
    })();
  }, [isAuthenticated]);

  // Handle notification taps
  useEffect(() => {
    const subscription = addNotificationResponseListener(
      (response) => {
        const data = response.notification.request.content.data;
        const isLeagueEvent =
          data?.type === 'chat_message' ||
          data?.type === 'feed_reaction' ||
          data?.type === 'feed_comment';

        // Every one of these originates in a league. The old code sent feed
        // events to `/(tabs)/challenges`, a tab that doesn't exist.
        if (isLeagueEvent && data?.leagueId) {
          router.push(`/league/${data.leagueId}` as any);
        }
      },
    );
    return () => subscription.remove();
  }, [router]);

  // Capture deep links
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      const joinPath = extractJoinPath(url);
      if (joinPath) pendingDeepLink.current = joinPath;
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const joinPath = extractJoinPath(url);
      if (joinPath) {
        if (isAuthenticated) {
          router.push(joinPath as any);
        } else {
          pendingDeepLink.current = joinPath;
        }
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    const inOnboarding = segments[0] === 'onboarding';
    const needsOnboarding = profile && 'onboarding_completed' in profile && profile.onboarding_completed === false;

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      if (needsOnboarding && !inOnboarding) {
        router.replace('/onboarding');
      } else if (pendingDeepLink.current) {
        const target = pendingDeepLink.current;
        pendingDeepLink.current = null;
        router.replace(target as any);
      } else {
        router.replace('/(tabs)');
      }
    } else if (isAuthenticated && needsOnboarding && !inOnboarding && !inAuthGroup) {
      router.replace('/onboarding');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="league" options={{ headerShown: false }} />
      <Stack.Screen
        name="session"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="lesson" options={{ headerShown: false }} />
      <Stack.Screen name="flashcards" options={{ headerShown: false }} />
      <Stack.Screen name="quizzes" options={{ headerShown: false }} />
      <Stack.Screen name="pricing" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const { mode } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Restore the saved theme before the first paint of any screen.
  useEffect(() => {
    hydrateTheme();
    initAnalytics();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AuthProvider>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <RootLayoutNav />
    </AuthProvider>
  );
}
