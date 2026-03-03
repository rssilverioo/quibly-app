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
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils';

interface LeagueDetail {
  id: string;
  name: string;
  description: string | null;
  mode: string;
  status: string;
  privacy: string;
  inviteCode: string;
  maxMembers: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  owner: { id: string; username: string };
  members: Array<{
    id: string;
    role: string;
    displayName: string;
    totalSp: number;
    weeklySp: number;
    verifiedHours: string;
    joinedAt: string;
    user: { id: string; username: string; avatarUrl: string | null };
  }>;
  _count: {
    members: number;
    sessions: number;
    feedPosts: number;
    chatMessages: number;
  };
}

function getStatusVariant(status: string): 'success' | 'warning' | 'default' {
  if (status === 'active') return 'success';
  if (status === 'completed') return 'warning';
  return 'default';
}

function getRoleVariant(role: string): 'pro' | 'default' {
  if (role === 'owner' || role === 'admin') return 'pro';
  return 'default';
}

export default function LeagueDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeague() {
      try {
        const data = await api.get<LeagueDetail>(`/admin/leagues/${id}`);
        setLeague(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load league');
      } finally {
        setLoading(false);
      }
    }
    fetchLeague();
  }, [id]);

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
          <p className="text-quibly-error text-lg font-medium mb-2">Error</p>
          <p className="text-quibly-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!league) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/leagues">
          <Button variant="ghost" size="sm">
            &larr; Back to Leagues
          </Button>
        </Link>
      </div>

      {/* League Info */}
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-quibly-text">{league.name}</h1>
            {league.description && (
              <p className="text-sm text-quibly-text-secondary mt-1">{league.description}</p>
            )}
          </div>
          <Badge variant={getStatusVariant(league.status)}>{league.status}</Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-quibly-text-muted">Owner</p>
            <p className="text-quibly-text font-medium">{league.owner.username}</p>
          </div>
          <div>
            <p className="text-quibly-text-muted">Mode</p>
            <p className="text-quibly-text font-medium">{league.mode}</p>
          </div>
          <div>
            <p className="text-quibly-text-muted">Privacy</p>
            <p className="text-quibly-text font-medium capitalize">{league.privacy}</p>
          </div>
          <div>
            <p className="text-quibly-text-muted">Invite Code</p>
            <p className="text-quibly-text font-mono font-medium">{league.inviteCode}</p>
          </div>
          <div>
            <p className="text-quibly-text-muted">Max Members</p>
            <p className="text-quibly-text font-medium">{league.maxMembers}</p>
          </div>
          <div>
            <p className="text-quibly-text-muted">Start Date</p>
            <p className="text-quibly-text font-medium">{formatDate(league.startDate)}</p>
          </div>
          <div>
            <p className="text-quibly-text-muted">End Date</p>
            <p className="text-quibly-text font-medium">{formatDate(league.endDate)}</p>
          </div>
          <div>
            <p className="text-quibly-text-muted">Created</p>
            <p className="text-quibly-text font-medium">{formatDateTime(league.createdAt)}</p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Members" value={formatNumber(league._count.members)} />
        <StatCard title="Sessions" value={formatNumber(league._count.sessions)} />
        <StatCard title="Feed Posts" value={formatNumber(league._count.feedPosts)} />
        <StatCard title="Chat Messages" value={formatNumber(league._count.chatMessages)} />
      </div>

      {/* Members Table */}
      <Card>
        <h2 className="text-lg font-semibold text-quibly-text mb-4">Members</h2>
        <Table>
          <Thead>
            <Tr>
              <Th>Display Name</Th>
              <Th>Username</Th>
              <Th>Role</Th>
              <Th>Total SP</Th>
              <Th>Weekly SP</Th>
              <Th>Verified Hours</Th>
              <Th>Joined</Th>
            </Tr>
          </Thead>
          <Tbody>
            {league.members.map((member) => (
              <Tr key={member.id}>
                <Td className="font-medium text-quibly-text">{member.displayName}</Td>
                <Td>
                  <Link
                    href={`/admin/users/${member.user.id}`}
                    className="text-quibly-primary hover:underline"
                  >
                    {member.user.username}
                  </Link>
                </Td>
                <Td>
                  <Badge variant={getRoleVariant(member.role)}>{member.role}</Badge>
                </Td>
                <Td>{formatNumber(member.totalSp)}</Td>
                <Td>{formatNumber(member.weeklySp)}</Td>
                <Td>{member.verifiedHours}</Td>
                <Td>{formatDate(member.joinedAt)}</Td>
              </Tr>
            ))}
            {league.members.length === 0 && (
              <Tr>
                <Td colSpan={7} className="text-center text-quibly-text-muted py-8">
                  No members
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
