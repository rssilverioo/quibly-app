import { initializeApp, getApps, getApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { initializeAuth, getAuth, type Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * `getReactNativePersistence` ships in the React Native build of
 * `firebase/auth`, but the package's published type declarations describe the
 * browser build and omit it. Reaching for it through the namespace keeps the
 * runtime behaviour identical while staying type-safe.
 */
const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence: (storage: unknown) => Persistence;
  }
).getReactNativePersistence;

/**
 * Placeholder config is worse than no config.
 *
 * These fields used to fall back to `'YOUR_API_KEY'` and friends. Firebase
 * accepts any string at `initializeApp` — it only rejects it on the first
 * request — so a build with no environment variables started up looking
 * healthy and then never resolved `onAuthStateChanged`. `AuthContext` clears
 * `isLoading` inside that callback, and `_layout.tsx` renders `null` while
 * loading, so the app sat behind the splash screen with nothing to show and
 * nothing logged.
 *
 * That is exactly what shipped to TestFlight in build 26: `.env` is
 * gitignored, so it never reached the EAS builder, and nobody noticed until
 * the app was on a phone.
 *
 * Note what this deliberately does *not* do: throw. This module is imported at
 * the root of the tree, so throwing here aborts evaluation of the whole bundle
 * and the app hangs on the splash — the very symptom we are trying to make
 * legible. Instead the problem is recorded and `app/_layout.tsx` renders it.
 */
/**
 * Cada variável precisa ser lida como `process.env.NOME_LITERAL`, e é por isso
 * que esta tabela existe em vez de uma lista de nomes.
 *
 * `babel-preset-expo` só substitui `process.env.X` quando a chave é literal
 * (`inline-env-vars.js`: `t.isStringLiteral(key)`). Um acesso computado —
 * `process.env[nome]` — atravessa o build intacto, e no bundle de release
 * `process.env` não carrega nenhuma chave `EXPO_PUBLIC_*`. Ou seja, o
 * `REQUIRED.filter((name) => !process.env[name])` que estava aqui acusava as
 * seis como ausentes em **todo** build de produção, por melhor configurado que
 * estivesse.
 *
 * Foi o que chegou ao TestFlight em 04/08: o `eas.json` carregava as seis em
 * `build.production.env` desde 30/07, elas eram inlinadas corretamente no
 * `firebaseConfig` abaixo — e esta tela bloqueava o app mesmo assim, nomeando
 * variáveis que estavam ali no bundle. Um guarda que existe para tornar a
 * falha legível passou a ser a falha.
 *
 * Agora a checagem e a configuração leem da mesma tabela, então é impossível
 * uma variável estar presente para uma e ausente para a outra.
 */
const CONFIG_ENV = {
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.keys(CONFIG_ENV).filter(
  (nome) => !CONFIG_ENV[nome as keyof typeof CONFIG_ENV],
);

/** Non-null when the build shipped without Firebase configuration. */
export const firebaseConfigError: string | null = missing.length
  ? `Faltam ${missing.length} variável(is) de ambiente: ${missing.join(', ')}.\n\n` +
    'No build elas vêm de `build.<perfil>.env`, em apps/mobile/eas.json — ' +
    'confira o perfil usado neste build. Em desenvolvimento vêm de ' +
    'apps/mobile/.env, que é gitignored e não chega ao builder.'
  : null;

const firebaseConfig = {
  apiKey: CONFIG_ENV.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: CONFIG_ENV.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: CONFIG_ENV.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: CONFIG_ENV.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: CONFIG_ENV.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: CONFIG_ENV.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function getFirebaseAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Already initialized (e.g. hot reload) — return existing instance
    return getAuth(app);
  }
}

export const auth = getFirebaseAuth();

export default app;
