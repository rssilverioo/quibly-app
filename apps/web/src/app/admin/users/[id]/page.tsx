'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { StatCard } from '@/components/charts/stat-card';
import { formatDate, formatDateTime } from '@/lib/utils';

interface UserDetail {
  id: string;
  email: string;
  username: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  plan: 'FREE' | 'PRO';
  verification: 'BLUE' | 'GOLD' | null;
  level: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  totalStudyMinutes: number;
  lockInScore: number;
  verifiedHours: string;
  subscriptionPlatform: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  documents: Array<{ id: string; title: string; createdAt: string }>;
  flashcardSets: Array<{
    id: string;
    title: string;
    createdAt: string;
    _count: { flashcards: number };
  }>;
  quizzes: Array<{
    id: string;
    title: string;
    score: number | null;
    totalQ: number;
    createdAt: string;
    _count: { questions: number };
  }>;
  _count: {
    documents: number;
    flashcardSets: number;
    quizzes: number;
    studySessions: number;
    userAchievements: number;
  };
}

function getInitials(username: string): string {
  return username
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingBadge, setSavingBadge] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  /**
   * Concede ou remove o selo.
   *
   * Clicar no selo que já está ativo o remove — é o comportamento de um par de
   * botões de rádio que aceita "nenhum", e evita um terceiro controle só para
   * dizer "sem selo".
   *
   * O estado local só muda depois da resposta do servidor. Um selo é uma
   * afirmação sobre uma pessoa real; mostrar otimista e depois voltar atrás
   * faria o painel mentir sobre quem foi verificado.
   */
  /**
   * O plano, à mão.
   *
   * Cortesia, teste e suporte — **não** assinatura. A rota mexe em `plan` e nada
   * mais; os campos de cobrança ficam como estão, e é o que permite separar
   * depois quem pagou de quem recebeu. Se isto preenchesse `subscriptionStatus`,
   * a tela de receita passaria a contar cortesia como venda.
   *
   * Como no selo, o estado local só muda depois da resposta.
   */
  async function setPlano(next: 'FREE' | 'PRO') {
    if (!user || savingPlan || user.plan === next) return;
    setSavingPlan(true);
    try {
      await api.patch(`/admin/users/${userId}/plan`, { plan: next });
      setUser({ ...user, plan: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan');
    } finally {
      setSavingPlan(false);
    }
  }

  async function setBadge(next: 'BLUE' | 'GOLD' | null) {
    if (!user || savingBadge) return;
    const value = user.verification === next ? null : next;
    setSavingBadge(true);
    try {
      await api.patch(`/admin/users/${userId}/verification`, { verification: value });
      setUser({ ...user, verification: value });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update badge');
    } finally {
      setSavingBadge(false);
    }
  }

  useEffect(() => {
    async function fetchUser() {
      try {
        const data = await api.get<UserDetail>(`/admin/users/${userId}`);
        setUser(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm">
            &larr; Back to Users
          </Button>
        </Link>
        <div className="flex items-center justify-center min-h-[40vh]">
          <p className="text-quibly-error">{error || 'User not found'}</p>
        </div>
      </div>
    );
  }

  const studyHours = Math.round(user.totalStudyMinutes / 60);

  return (
    <div className="space-y-6">
      <Link href="/admin/users">
        <Button variant="ghost" size="sm">
          &larr; Back to Users
        </Button>
      </Link>

      {/* User Info Card */}
      <Card className="flex items-start gap-5">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-quibly-primary/20 flex items-center justify-center text-lg font-bold text-quibly-primary-light flex-shrink-0">
            {getInitials(user.username)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-quibly-text">{user.username}</h1>
            <Badge variant={user.plan === 'PRO' ? 'pro' : 'default'}>{user.plan}</Badge>
          </div>
          <p className="text-sm text-quibly-text-muted">@{user.handle}</p>
          <p className="text-sm text-quibly-text-secondary mt-1">{user.email}</p>
          {user.bio && (
            <p className="text-sm text-quibly-text-muted mt-2">{user.bio}</p>
          )}
          <p className="text-xs text-quibly-text-muted mt-2">
            Joined {formatDate(user.createdAt)}
          </p>

          {/*
            Os selos.

            Concedidos aqui e em nenhum outro lugar — não existe rota que o
            usuário alcance. É o que mantém o selo significando "é mesmo essa
            pessoa" em vez de "pagou", que foi o que aconteceu com o X.
          */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs font-medium text-quibly-text-muted mb-2">
              Plan
            </p>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <BadgeToggle
                active={user.plan === 'PRO'}
                disabled={savingPlan}
                onClick={() => setPlano('PRO')}
                color="#E8B923"
                label="Pro"
                hint="Grant manually — not a purchase"
              />
              {user.plan === 'PRO' && (
                <button
                  onClick={() => setPlano('FREE')}
                  disabled={savingPlan}
                  className="text-xs text-quibly-text-muted hover:text-quibly-text underline disabled:opacity-50"
                >
                  Back to free
                </button>
              )}
            </div>

            <p className="text-xs font-medium text-quibly-text-muted mb-2">
              Verification
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <BadgeToggle
                active={user.verification === 'BLUE'}
                disabled={savingBadge}
                onClick={() => setBadge('BLUE')}
                color="#1D9BF0"
                label="Verified"
                hint="Identity confirmed"
              />
              <BadgeToggle
                active={user.verification === 'GOLD'}
                disabled={savingBadge}
                onClick={() => setBadge('GOLD')}
                color="#E8B923"
                label="Teacher"
                hint="Verified educator"
              />
              {user.verification && (
                <button
                  onClick={() => setBadge(null)}
                  disabled={savingBadge}
                  className="text-xs text-quibly-text-muted hover:text-quibly-text underline disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-quibly-text-muted mt-2">
              Gold is for teachers only. Students use it to decide whose room to
              trust, so a wrong one costs more than a missing one.
            </p>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Level" value={user.level} />
        <StatCard title="XP" value={user.totalXp.toLocaleString()} />
        <StatCard title="Current Streak" value={`${user.currentStreak}d`} />
        <StatCard title="Longest Streak" value={`${user.longestStreak}d`} />
        <StatCard title="Study Hours" value={studyHours} />
        <StatCard title="Lock-In Score" value={user.lockInScore} />
        <StatCard title="Verified Hours" value={parseFloat(user.verifiedHours).toFixed(1)} />
        <StatCard title="Achievements" value={user._count.userAchievements} />
      </div>

      {/* Plan & Subscription */}
      {user.plan === 'PRO' && (
        <Card>
          <h2 className="text-lg font-semibold text-quibly-text mb-4">Subscription</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-quibly-text-muted">Status</p>
              <p className="text-quibly-text font-medium mt-0.5">
                {user.subscriptionStatus || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-quibly-text-muted">Platform</p>
              <p className="text-quibly-text font-medium mt-0.5 break-all">
                {user.subscriptionPlatform || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-quibly-text-muted">Current Period End</p>
              <p className="text-quibly-text font-medium mt-0.5">
                {user.currentPeriodEnd ? formatDateTime(user.currentPeriodEnd) : 'N/A'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Documents */}
        <Card>
          <h2 className="text-lg font-semibold text-quibly-text mb-4">
            Recent Documents
            <span className="text-sm font-normal text-quibly-text-muted ml-2">
              ({user._count.documents})
            </span>
          </h2>
          {user.documents.length === 0 ? (
            <p className="text-sm text-quibly-text-muted">No documents</p>
          ) : (
            <ul className="space-y-3">
              {user.documents.map((doc) => (
                <li key={doc.id} className="flex items-start justify-between gap-2">
                  <p className="text-sm text-quibly-text truncate flex-1">{doc.title}</p>
                  <p className="text-xs text-quibly-text-muted flex-shrink-0">
                    {formatDate(doc.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent Flashcard Sets */}
        <Card>
          <h2 className="text-lg font-semibold text-quibly-text mb-4">
            Recent Flashcard Sets
            <span className="text-sm font-normal text-quibly-text-muted ml-2">
              ({user._count.flashcardSets})
            </span>
          </h2>
          {user.flashcardSets.length === 0 ? (
            <p className="text-sm text-quibly-text-muted">No flashcard sets</p>
          ) : (
            <ul className="space-y-3">
              {user.flashcardSets.map((set) => (
                <li key={set.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-quibly-text truncate">{set.title}</p>
                    <p className="text-xs text-quibly-text-muted">
                      {set._count.flashcards} cards
                    </p>
                  </div>
                  <p className="text-xs text-quibly-text-muted flex-shrink-0">
                    {formatDate(set.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent Quizzes */}
        <Card>
          <h2 className="text-lg font-semibold text-quibly-text mb-4">
            Recent Quizzes
            <span className="text-sm font-normal text-quibly-text-muted ml-2">
              ({user._count.quizzes})
            </span>
          </h2>
          {user.quizzes.length === 0 ? (
            <p className="text-sm text-quibly-text-muted">No quizzes</p>
          ) : (
            <ul className="space-y-3">
              {user.quizzes.map((quiz) => (
                <li key={quiz.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-quibly-text truncate">{quiz.title}</p>
                    <p className="text-xs text-quibly-text-muted">
                      {quiz.score !== null ? `${quiz.score}/${quiz.totalQ}` : `${quiz._count.questions} questions`}
                    </p>
                  </div>
                  <p className="text-xs text-quibly-text-muted flex-shrink-0">
                    {formatDate(quiz.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/**
 * Um selo, ligado ou desligado.
 *
 * Caixa de seleção e não interruptor: os dois selos são mutuamente exclusivos
 * — uma pessoa é verificada **ou** professora, nunca as duas —, e um par de
 * caixas onde marcar uma desmarca a outra é o gesto que o painel precisa.
 *
 * O visto desenhado à mão, e não um emoji: o emoji muda de forma em cada
 * sistema, e este é o mesmo símbolo que o app vai desenhar do outro lado.
 */
function BadgeToggle({
  active, disabled, onClick, color, label, hint,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  color: string;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition disabled:opacity-50 ${
        active
          ? 'border-transparent text-white'
          : 'border-white/15 text-quibly-text-muted hover:border-white/30'
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 1.5l2.6 2.1 3.3-.3.9 3.2 2.9 1.6-1.3 3.1 1.3 3.1-2.9 1.6-.9 3.2-3.3-.3L12 22.5l-2.6-2.1-3.3.3-.9-3.2-2.9-1.6L3.6 12.8 2.3 9.7l2.9-1.6.9-3.2 3.3.3L12 1.5z"
          fill={active ? '#FFFFFF' : color}
          opacity={active ? 0.28 : 1}
        />
        <path
          d="M8.4 12.2l2.5 2.5 4.7-5"
          fill="none"
          stroke={active ? '#FFFFFF' : '#0A0A0F'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </button>
  );
}
