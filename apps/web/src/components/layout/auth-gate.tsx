'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-quibly-bg flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-quibly-bg flex items-center justify-center p-4">
        <div className="bg-quibly-surface border border-quibly-border rounded-xl p-8 max-w-sm w-full">
          <h1 className="text-xl font-bold text-quibly-text text-center mb-1">Quibly Admin</h1>
          <p className="text-sm text-quibly-text-muted text-center mb-6">Sign in to continue</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setSubmitting(true);
              try {
                await signInWithEmailAndPassword(auth, email, password);
              } catch (err: any) {
                setError(err.code === 'auth/invalid-credential' ? 'Invalid email or password' : err.message);
              } finally {
                setSubmitting(false);
              }
            }}
            className="space-y-4"
          >
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p className="text-sm text-quibly-error">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
