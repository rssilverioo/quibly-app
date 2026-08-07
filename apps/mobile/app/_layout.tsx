import { useEffect, useRef, useCallback } from 'react';
import { LogBox, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { firebaseConfigError } from '../lib/firebase';
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

// A única exceção à regra acima, e ela não vale no desenvolvimento normal.
// Durante a captura de telas (`npm run print:ios`) o overlay do LogBox se
// empilha exatamente sobre a barra de abas — que é justamente um elemento que
// precisamos julgar contra a referência. Print com aviso por cima esconde a
// interface que ele deveria provar.
//
// Atrás de variável de ambiente porque cegar o LogBox por padrão é como a
// regra acima nasceu: aviso permanente treina você a ignorar os que importam.
// Quem roda o app na mão continua vendo tudo.
if (process.env.EXPO_PUBLIC_SEM_LOGBOX === '1') LogBox.ignoreAllLogs();

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


/**
 * A ação que a Live Activity pediu, ou `null`.
 *
 * Os botões do widget disparam `quibly://session/pause|resume|end`. Até aqui
 * ninguém tratava essas rotas: o app abria e o Expo Router mostrava
 * **"Unmatched Route"** — os controles da tela de bloqueio nunca funcionaram no
 * iOS, e o defeito só apareceu num print de aparelho.
 *
 * Este é o caminho de quem está em **iOS 16**, onde `Button(intent:)` não
 * existe em Live Activity. No 17+ o App Intent age sem abrir o app; aqui o app
 * abre e o store faz o resto — mais lento, e melhor que não funcionar.
 */
function acaoDaLiveActivity(url: string | null): 'pause' | 'resume' | 'end' | null {
  if (!url) return null;
  const { path } = Linking.parse(url);
  if (!path?.startsWith('session/')) return null;

  const acao = path.slice('session/'.length);
  return acao === 'pause' || acao === 'resume' || acao === 'end' ? acao : null;
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
          router.push(`/league/room/${data.leagueId}` as any);
        }
      },
    );
    return () => subscription.remove();
  }, [router]);

  /**
   * Aplica pause/resume/end no **mesmo store** que os controles em tela usam.
   *
   * É o que garante que as duas superfícies não possam discordar: não há um
   * segundo caminho para pausar, só um segundo jeito de pedir.
   */
  const aplicarAcao = useCallback((acao: 'pause' | 'resume' | 'end' | null) => {
    if (!acao) return;
    const store = useSessionStore.getState();
    // Sem sessão viva não há o que pausar — o widget pode ter sobrevivido ao
    // fim dela, e agir aqui recriaria estado que o servidor já encerrou.
    if (!store.currentSession) return;

    if (acao === 'pause') void store.pause();
    else if (acao === 'resume') void store.resume();
    else void store.endSession();
  }, []);

  // Capture deep links
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      const joinPath = extractJoinPath(url);
      if (joinPath) pendingDeepLink.current = joinPath;
      aplicarAcao(acaoDaLiveActivity(url));
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
      aplicarAcao(acaoDaLiveActivity(url));
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

  // Checked before the loading gate on purpose. With Firebase misconfigured,
  // `onAuthStateChanged` never fires, `isLoading` never clears, and the
  // `return null` below leaves the splash up forever with nothing logged —
  // which is how build 26 reached TestFlight and stalled there. Name the
  // missing variables on screen instead of hanging.
  if (firebaseConfigError) {
    return (
      <View style={[styles.configError, { backgroundColor: c.bg }]}>
        <Text style={[styles.configErrorTitle, { color: c.fg }]}>Configuração ausente</Text>
        <Text style={[styles.configErrorBody, { color: c.fgMuted }]}>{firebaseConfigError}</Text>
      </View>
    );
  }

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
  // Os quatro pesos que `FONTS` nomeia em @quibly/shared. Carregar de menos
  // aqui não dá erro: o texto simplesmente cai para a fonte do sistema, que é
  // o tipo de bug que ninguém vê no simulador e todo mundo vê na loja.
  //
  // A Inter continua instalada (`@expo-google-fonts/inter` no package.json) de
  // propósito, como plano B: se a Nunito falhar em runtime, voltar é trocar
  // estas quatro linhas e o bloco FONTS do shared, sem npm install no meio.
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
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

const styles = StyleSheet.create({
  configError: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  configErrorTitle: { fontSize: 20, fontWeight: '700' },
  configErrorBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
