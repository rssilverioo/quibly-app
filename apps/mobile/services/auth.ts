import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  OAuthProvider,
  signInWithCredential,
  User,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { auth } from '../lib/firebase';
import { api } from '../lib/api';
import type { Profile } from '@quibly/shared';

export async function register(email: string, password: string, username: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  const handle = username.toLowerCase().replace(/\s+/g, '_');

  // Create profile in the API (PostgreSQL via Prisma)
  const profile = await api.post<Profile>('/auth/profile', { username, handle });

  return { uid, profile };
}

export async function login(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

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

  return { user, isNewUser: true };
}

export async function logout() {
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
