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
  level: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  totalStudyMinutes: number;
  lockInScore: number;
  verifiedHours: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
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
              <p className="text-quibly-text-muted">Price ID</p>
              <p className="text-quibly-text font-medium mt-0.5 break-all">
                {user.stripePriceId || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-quibly-text-muted">Stripe Customer</p>
              <p className="text-quibly-text font-medium mt-0.5 break-all">
                {user.stripeCustomerId || 'N/A'}
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
