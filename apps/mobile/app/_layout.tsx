import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import AnimatedSplash from '../components/common/AnimatedSplash';
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
import { COLORS } from '@quibly/shared/constants';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import {
  configureNotifications,
  requestNotificationPermissions,
  getDevicePushToken,
  addNotificationResponseListener,
} from '../lib/notifications';
import { registerPushToken } from '../services/notifications';
import { initRevenueCat } from '../services/iap';
import '../lib/i18n';

SplashScreen.preventAutoHideAsync();

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
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pendingDeepLink = useRef<string | null>(null);
  const pushTokenRegistered = useRef(false);
  const [splashFinished, setSplashFinished] = useState(false);

  // Initialize notifications
  useEffect(() => {
    configureNotifications();
  }, []);

  // Initialize RevenueCat when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;
    initRevenueCat(user.uid).catch((err) =>
      console.warn('Failed to init RevenueCat:', err),
    );
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
      }
    })();
  }, [isAuthenticated]);

  // Handle notification taps
  useEffect(() => {
    const subscription = addNotificationResponseListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'chat_message' && data?.leagueId) {
          router.push(`/league/${data.leagueId}` as any);
        } else if (data?.type === 'feed_reaction' || data?.type === 'feed_comment') {
          router.push('/(tabs)/challenges' as any);
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

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      if (pendingDeepLink.current) {
        const target = pendingDeepLink.current;
        pendingDeepLink.current = null;
        router.replace(target as any);
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading || !splashFinished) {
    return <AnimatedSplash onFinish={() => setSplashFinished(true)} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="league" options={{ headerShown: false }} />
      <Stack.Screen
        name="session"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen name="upload" options={{ headerShown: false }} />
      <Stack.Screen name="generate" options={{ headerShown: false }} />
      <Stack.Screen name="flashcards" options={{ headerShown: false }} />
      <Stack.Screen name="quizzes" options={{ headerShown: false }} />
      <Stack.Screen name="pricing" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootLayoutNav />
    </AuthProvider>
  );
}
