import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getProfile, ensureProfile } from '../services/auth';
import type { Profile } from '@quibly/shared';
import { identify, setUserProperties, track } from '../lib/analytics';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Profile | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  refreshProfile: async () => {},
  setProfile: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * The streak is computed server-side, so the client only ever sees the
   * result. Watching the value across refreshes is the one place we can tell
   * "kept it" from "lost it" — and losing it is the retention signal worth
   * having.
   */
  const lastStreak = useRef<number | null>(null);

  const noteStreakChange = (p: Profile | null) => {
    const next = p?.current_streak ?? null;
    const prev = lastStreak.current;
    lastStreak.current = next;

    if (prev === null || next === null || next === prev) return;
    if (next > prev) track('streak_continued', { days: next });
    else if (next < prev) track('streak_broken', { previous_days: prev });
  };

  const fetchProfile = async (): Promise<Profile | null> => {
    return getProfile();
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile();
      setProfile(p);
      noteStreakChange(p);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      identify(firebaseUser?.uid ?? null);
      if (firebaseUser) {
        try {
          let p = await fetchProfile();
          if (!p) {
            // Profile doesn't exist in PostgreSQL yet — create it
            p = await ensureProfile(firebaseUser);
          }
          setProfile(p);
          lastStreak.current = p?.current_streak ?? null;
          setUserProperties({
            plan: p?.plan,
            education_level: p?.education_level ?? undefined,
            study_goal: p?.study_goal ?? undefined,
          });
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated: !!user,
        refreshProfile,
        setProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
