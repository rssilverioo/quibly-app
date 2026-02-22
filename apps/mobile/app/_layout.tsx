import { useEffect, useRef } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
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
import { COLORS } from '@quibly/shared/constants';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import {
  configureNotifications,
  requestNotificationPermissions,
  getDevicePushToken,
  addNotificationResponseListener,
} from '../lib/notifications';
import { registerPushToken } from '../services/notifications';
import '../lib/i18n';

SplashScreen.preventAutoHideAsync();

function extractJoinPath(url: string | null): string | null {
  if (!url) return null;
  const parsed = Linking.parse(url);
  if (parsed.path?.startsWith('league/join/')) {
    return `/${parsed.path}`;
  }
  return null;
}

function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start();
    a2.start();
    a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={splashStyles.dotsRow}>
      {[dot1, dot2, dot3].map((opacity, i) => (
        <Animated.View key={i} style={[splashStyles.dot, { opacity }]} />
      ))}
    </View>
  );
}

function AppSplash() {
  return (
    <View style={splashStyles.container}>
      <Image source={require('../assets/icon.png')} style={splashStyles.logo} resizeMode="contain" />
      <LoadingDots />
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 120, height: 120, marginBottom: 40, borderRadius: 24 },
  dotsRow: { flexDirection: 'row', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
});

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pendingDeepLink = useRef<string | null>(null);
  const pushTokenRegistered = useRef(false);

  // Initialize notifications
  useEffect(() => {
    configureNotifications();
  }, []);

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
          router.push('/(tabs)/leagues' as any);
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

  if (isLoading) return <AppSplash />;

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
