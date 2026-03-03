'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Pagination } from '@/components/ui/pagination';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';

interface League {
  id: string;
  name: string;
  description: string | null;
  mode: string;
  status: string;
  privacy: string;
  inviteCode: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  owner: { id: string; username: string };
  _count: { members: number };
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

const STATUS_OPTIONS = ['all', 'upcoming', 'active', 'completed'] as const;

function getStatusVariant(status: string): 'success' | 'warning' | 'default' {
  if (status === 'active') return 'success';
  if (status === 'completed') return 'warning';
  return 'default';
}

export default function LeaguesPage() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, total_pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeagues = useCallback(async (page: number, searchVal: string, statusVal: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (searchVal) params.set('search', searchVal);
      if (statusVal && statusVal !== 'all') params.set('status', statusVal);
      const res = await api.get<{ leagues: League[]; pagination: PaginationMeta }>(
        `/admin/leagues?${params}`,
      );
      setLeagues(res.leagues);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leagues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeagues(1, '', 'all');
  }, [fetchLeagues]);

  /* Search debounce */
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeagues(1, search, status);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, status, fetchLeagues]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-quibly-text">Leagues</h1>

      {error && (
        <div className="text-quibly-error text-sm bg-quibly-error/10 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
          <Input
            placeholder="Search leagues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-quibly-surface-light border border-quibly-border rounded-lg px-4 py-2.5 text-sm text-quibly-text focus:outline-none focus:ring-2 focus:ring-quibly-primary focus:border-transparent transition-colors"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'All Statuses' : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="w-6 h-6" />
          </div>
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Owner</Th>
                  <Th>Mode</Th>
                  <Th>Status</Th>
                  <Th>Members</Th>
                  <Th>Privacy</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {leagues.map((league) => (
                  <Tr
                    key={league.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/leagues/${league.id}`)}
                  >
                    <Td className="font-medium text-quibly-text">{league.name}</Td>
                    <Td>{league.owner.username}</Td>
                    <Td>
                      <Badge>{league.mode}</Badge>
                    </Td>
                    <Td>
                      <Badge variant={getStatusVariant(league.status)}>
                        {league.status}
                      </Badge>
                    </Td>
                    <Td>{league._count.members}</Td>
                    <Td className="capitalize">{league.privacy}</Td>
                    <Td>{formatDate(league.createdAt)}</Td>
                  </Tr>
                ))}
                {leagues.length === 0 && (
                  <Tr>
                    <Td colSpan={7} className="text-center text-quibly-text-muted py-8">
                      No leagues found
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
            <Pagination
              page={pagination.page}
              totalPages={pagination.total_pages}
              onPageChange={(p) => fetchLeagues(p, search, status)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
