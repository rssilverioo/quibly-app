'use client';

import { useAuth } from '@/lib/auth-context';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '../ui/button';

export function TopBar() {
  const { user } = useAuth();

  return (
    <header className="h-14 border-b border-quibly-border bg-quibly-surface flex items-center justify-between px-6">
      {/* A barra existe só para a conta e a saída. Um espaço vazio à esquerda
          era peso morto; agora ela carrega quem está logado, que é a informação
          que importa num painel com poder de banir gente. */}
      <span className="text-xs uppercase tracking-[0.16em] text-quibly-text-muted">
        Administração
      </span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-quibly-text-secondary">{user?.email}</span>
        <Button variant="ghost" size="sm" onClick={() => signOut(auth)}>
          Sair
        </Button>
      </div>
    </header>
  );
}
