import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getProfile, ensureProfile } from '../services/auth';
import type { Profile } from '@quibly/shared';
import { identify, setAnalyticsContext, setUserProperties } from '../lib/analytics';
import { identifyForSentry } from '../lib/sentry';

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

  const fetchProfile = async (): Promise<Profile | null> => {
    return getProfile();
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile();
      setProfile(p);
      if (p?.plan) setAnalyticsContext({ plan: p.plan });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      identify(firebaseUser?.uid ?? null);
      identifyForSentry(firebaseUser?.uid ?? null);
      if (firebaseUser) {
        try {
          let p = await fetchProfile();
          if (!p) {
            // Profile doesn't exist in PostgreSQL yet — create it
            p = await ensureProfile(firebaseUser);
          }
          setProfile(p);
          if (p?.plan) setAnalyticsContext({ plan: p.plan });
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
