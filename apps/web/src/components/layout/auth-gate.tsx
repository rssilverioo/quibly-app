'use client';

import { useEffect, useState } from 'react';
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';

/**
 * A porta do painel.
 *
 * ## Por que existe link por e-mail
 *
 * Só havia e-mail e senha. Quem criou a conta com "Entrar com a Apple" — o caso
 * do dono do produto — **não tem senha**: não existe senha para lembrar nem para
 * redefinir. Ele estava trancado do lado de fora do próprio painel.
 *
 * O link resolve mantendo o **mesmo UID**. É o que importa: o acesso de admin é
 * uma lista de UIDs em `ADMIN_USER_IDS`, e entrar por outro provedor criaria uma
 * conta diferente, com outro id, que não estaria na lista. Como o Firebase junta
 * provedores que compartilham o mesmo e-mail, o link cai na conta que já existe.
 *
 * ## Por que a senha continua aí
 *
 * Conta de admin dedicada — separada da conta pessoal — é a prática melhor: a
 * conta do app tem posts, salas e assinatura; a de admin tem o poder de banir
 * gente. Quem preferir esse caminho continua entrando por senha.
 *
 * ## O que o link **não** dá
 *
 * Acesso. Ele prova quem você é; quem decide o que você pode é o `AdminGuard` da
 * API, contra `ADMIN_USER_IDS`. Entrar aqui com um e-mail qualquer resulta em
 * "Admin access required" em toda chamada — que é o comportamento certo.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [concluindoLink, setConcluindoLink] = useState(false);

  /**
   * A volta do link.
   *
   * O e-mail fica no `localStorage` porque o link pode ser aberto noutro
   * navegador — e aí o Firebase não tem como saber para quem ele foi emitido.
   * Sem o endereço guardado, perguntamos de novo em vez de falhar.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const guardado = window.localStorage.getItem('quibly.admin.email');
    const endereco = guardado ?? window.prompt('Confirme o e-mail que recebeu o link:');
    if (!endereco) return;

    setConcluindoLink(true);
    signInWithEmailLink(auth, endereco, window.location.href)
      .then(() => {
        window.localStorage.removeItem('quibly.admin.email');
        // Tira o link da barra de endereço: ele é de uso único, e deixá-lo ali
        // convida a recarregar a página numa URL que já não funciona.
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch((err) => setError(err?.message ?? 'Não deu para entrar com este link'))
      .finally(() => setConcluindoLink(false));
  }, []);

  if (loading || concluindoLink) {
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
          <p className="text-sm text-quibly-text-muted text-center mb-6">Entre para continuar</p>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setAviso('');
              setSubmitting(true);
              try {
                await signInWithEmailAndPassword(auth, email, password);
              } catch (err: any) {
                setError(
                  err.code === 'auth/invalid-credential'
                    ? 'E-mail ou senha inválidos'
                    : err.message,
                );
              } finally {
                setSubmitting(false);
              }
            }}
            className="space-y-4"
          >
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-quibly-error">{error}</p>}
            {aviso && <p className="text-sm text-green-400">{aviso}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          {/* Para quem entrou pela Apple e não tem senha. Só precisa do e-mail —
              por isso fica fora do `form`, que exige a senha. */}
          <button
            type="button"
            disabled={submitting || !email}
            onClick={async () => {
              setError('');
              setAviso('');
              setSubmitting(true);
              try {
                await sendSignInLinkToEmail(auth, email, {
                  url: window.location.origin + '/admin',
                  handleCodeInApp: true,
                });
                window.localStorage.setItem('quibly.admin.email', email);
                setAviso('Link enviado. Abra o e-mail neste mesmo navegador.');
              } catch (err: any) {
                setError(err?.message ?? 'Não deu para enviar o link');
              } finally {
                setSubmitting(false);
              }
            }}
            className="mt-4 w-full rounded-lg border border-quibly-border py-2.5 text-sm text-quibly-text-muted hover:text-quibly-text disabled:opacity-40"
          >
            Entrar por link no e-mail (sem senha)
          </button>
          <p className="mt-3 text-center text-xs text-quibly-text-muted">
            Use isto se criou a conta com &ldquo;Entrar com a Apple&rdquo;.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
