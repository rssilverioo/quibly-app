import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
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
