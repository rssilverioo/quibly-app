'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { StatCard } from '@/components/charts/stat-card';
import { LineChart } from '@/components/charts/line-chart';
import { Spinner } from '@/components/ui/spinner';
import { formatNumber } from '@/lib/utils';

interface AdminStats {
  total_users: number;
  pro_users: number;
  total_documents: number;
  total_flashcard_sets: number;
  total_quizzes: number;
  generations_today: { flashcard_sets: number; quizzes: number };
}

interface GrowthData {
  signups: { date: string; count: number }[];
  generations: { date: string; flashcard_sets: number; quizzes: number }[];
  activeUsers: { date: string; count: number }[];
}

function formatChartDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsData, growthData] = await Promise.all([
          api.get<AdminStats>('/admin/stats'),
          api.get<GrowthData>('/admin/growth?days=30'),
        ]);
        setStats(statsData);
        setGrowth(growthData);
      } catch (err) {
        if (err instanceof Error && err.message.includes('403')) {
          setError('Admin access required - check your account permissions');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-quibly-error text-lg font-medium mb-2">Access Denied</p>
          <p className="text-quibly-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats || !growth) return null;

  const signupsChartData = growth.signups.map((d) => ({
    date: formatChartDate(d.date),
    count: d.count,
  }));

  const generationsChartData = growth.generations.map((d) => ({
    date: formatChartDate(d.date),
    flashcard_sets: d.flashcard_sets,
    quizzes: d.quizzes,
  }));

  const activeUsersChartData = growth.activeUsers.map((d) => ({
    date: formatChartDate(d.date),
    count: d.count,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-quibly-text">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Users"
          value={formatNumber(stats.total_users)}
        />
        <StatCard
          title="PRO Users"
          value={formatNumber(stats.pro_users)}
        />
        <StatCard
          title="Documents"
          value={formatNumber(stats.total_documents)}
        />
        <StatCard
          title="Flashcard Sets"
          value={formatNumber(stats.total_flashcard_sets)}
        />
        <StatCard
          title="Quizzes"
          value={formatNumber(stats.total_quizzes)}
        />
        <StatCard
          title="Generations Today"
          value={`${stats.generations_today.flashcard_sets} flashcards + ${stats.generations_today.quizzes} quizzes`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <LineChart
          title="New Signups"
          data={signupsChartData}
          xKey="date"
          lines={[{ key: 'count', color: '#1E40AF', label: 'Signups' }]}
        />
        <LineChart
          title="Content Generated"
          data={generationsChartData}
          xKey="date"
          lines={[
            { key: 'flashcard_sets', color: '#1E40AF', label: 'Flashcard Sets' },
            { key: 'quizzes', color: '#00D4AA', label: 'Quizzes' },
          ]}
        />
        <LineChart
          title="Active Users"
          data={activeUsersChartData}
          xKey="date"
          lines={[{ key: 'count', color: '#00D4AA', label: 'Active Users' }]}
        />
      </div>
    </div>
  );
}
