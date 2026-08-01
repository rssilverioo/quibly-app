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
const REQUIRED = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

const missing = REQUIRED.filter((name) => !process.env[name]);

/** Non-null when the build shipped without Firebase configuration. */
export const firebaseConfigError: string | null = missing.length
  ? `Missing ${missing.length} environment variable(s): ${missing.join(', ')}.\n\n` +
    'apps/mobile/.env is gitignored, so it never reaches the EAS builder. ' +
    'The variables have to live on EAS: eas env:push production --path .env'
  : null;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
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
