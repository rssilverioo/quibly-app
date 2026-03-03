'use client';

import { useAuth } from '@/lib/auth-context';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '../ui/button';

export function TopBar() {
  const { user } = useAuth();

  return (
    <header className="h-14 border-b border-quibly-border bg-quibly-surface flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-quibly-text-secondary">{user?.email}</span>
        <Button variant="ghost" size="sm" onClick={() => signOut(auth)}>
          Sign Out
        </Button>
      </div>
    </header>
  );
}
