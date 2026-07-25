import {
  signOut,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  User,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { auth } from '../lib/firebase';
import { track } from '../lib/analytics';
import { api } from '../lib/api';
import type { Profile } from '@quibly/shared';

GoogleSignin.configure({
  iosClientId: '419383312629-hl004370ib4ea9ni56daf3vu1k3g5ns2.apps.googleusercontent.com',
});

export async function signInWithApple(): Promise<{ user: User; isNewUser: boolean }> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const rawNonce = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!appleCredential.identityToken) {
    throw new Error('Apple Sign-In failed: no identity token returned.');
  }

  const provider = new OAuthProvider('apple.com');
  const firebaseCredential = provider.credential({
    idToken: appleCredential.identityToken,
    rawNonce,
  });

  const { user } = await signInWithCredential(auth, firebaseCredential);

  const fullName = [
    appleCredential.fullName?.givenName,
    appleCredential.fullName?.familyName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const existingProfile = await getProfile();
  if (existingProfile) {
    return { user, isNewUser: false };
  }

  const displayName = fullName || user.displayName || user.email?.split('@')[0] || 'user';
  const handle = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30);
  await api.post<Profile>('/auth/profile', { username: displayName, handle });

  track('login_succeeded', { method: 'apple' });
  return { user, isNewUser: true };
}

export async function signInWithGoogle(): Promise<{ user: User; isNewUser: boolean }> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken ?? (result as any).idToken;

  if (!idToken) {
    throw new Error('Google Sign-In failed: no ID token returned.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const { user } = await signInWithCredential(auth, credential);

  const existingProfile = await getProfile();
  if (existingProfile) {
    return { user, isNewUser: false };
  }

  const displayName = user.displayName || user.email?.split('@')[0] || 'user';
  const handle = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30);
  await api.post<Profile>('/auth/profile', { username: displayName, handle });

  track('login_succeeded', { method: 'google' });
  return { user, isNewUser: true };
}

export { statusCodes as googleStatusCodes };

export async function logout() {
  try {
    await GoogleSignin.signOut();
  } catch {}
  await signOut(auth);
}

export async function getProfile(): Promise<Profile | null> {
  try {
    return await api.get<Profile>('/auth/me');
  } catch {
    return null;
  }
}

export async function ensureProfile(firebaseUser: User): Promise<Profile> {
  const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user';
  const handle = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30);

  return api.post<Profile>('/auth/profile', { username: name, handle });
}

export async function updateProfile(
  data: Partial<Pick<Profile, 'username' | 'handle' | 'bio' | 'avatar_url'>>
): Promise<Profile> {
  return api.patch<Profile>('/users/me', data);
}

export async function deleteAccount(): Promise<void> {
  await api.delete('/users/me');
  await signOut(auth);
}
