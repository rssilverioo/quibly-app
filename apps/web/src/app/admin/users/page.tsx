'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Pagination } from '@/components/ui/pagination';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { formatDate, formatNumber } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  username: string;
  handle: string;
  avatarUrl: string | null;
  plan: 'FREE' | 'PRO';
  level: number;
  totalXp: number;
  currentStreak: number;
  totalStudyMinutes: number;
  createdAt: string;
  _count: {
    documents: number;
    flashcardSets: number;
    quizzes: number;
    studySessions: number;
  };
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Highest Level', value: 'level' },
  { label: 'Most XP', value: 'xp' },
];

const PLAN_OPTIONS = [
  { label: 'All Plans', value: '' },
  { label: 'FREE', value: 'FREE' },
  { label: 'PRO', value: 'PRO' },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (plan) params.set('plan', plan);
      params.set('sort', sort);

      const data = await api.get<UsersResponse>(`/admin/users?${params.toString()}`);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch {
      // Error handled silently - users array stays empty
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, plan, sort]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function getInitials(username: string): string {
    return username
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-quibly-text">Pessoas</h1>
        <p className="mt-1 text-sm text-quibly-text-muted">Quem usa o Quibly. Aqui se concede o selo de verificado e se consulta o histórico de alguém.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Buscar por nome, e-mail ou @"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            setPage(1);
          }}
          className="bg-quibly-surface-light border border-quibly-border rounded-lg px-4 py-2.5 text-sm text-quibly-text focus:outline-none focus:ring-2 focus:ring-quibly-primary focus:border-transparent transition-colors"
        >
          {PLAN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="bg-quibly-surface-light border border-quibly-border rounded-lg px-4 py-2.5 text-sm text-quibly-text focus:outline-none focus:ring-2 focus:ring-quibly-primary focus:border-transparent transition-colors"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      ) : (
        <>
          <Table>
            <Thead>
              <Tr>
                <Th>Pessoa</Th>
                <Th>E-mail</Th>
                <Th>Plano</Th>
                <Th>Nível</Th>
                <Th>XP</Th>
                <Th>Sequência</Th>
                <Th>Sessões</Th>
                <Th>Entrou em</Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.length === 0 ? (
                <Tr>
                  <Td colSpan={8} className="text-center py-10 text-quibly-text-muted">
                    No users found
                  </Td>
                </Tr>
              ) : (
                users.map((user) => (
                  <Tr
                    key={user.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.username}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-quibly-primary/20 flex items-center justify-center text-xs font-medium text-quibly-primary-light">
                            {getInitials(user.username)}
                          </div>
                        )}
                        <div>
                          <p className="text-quibly-text font-medium">{user.username}</p>
                          <p className="text-xs text-quibly-text-muted">@{user.handle}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>{user.email}</Td>
                    <Td>
                      <Badge variant={user.plan === 'PRO' ? 'pro' : 'default'}>
                        {user.plan}
                      </Badge>
                    </Td>
                    <Td>{user.level ?? 0}</Td>
                    <Td>{formatNumber(user.totalXp)}</Td>
                    <Td>{user.currentStreak ?? 0}d</Td>
                    <Td>{user._count?.studySessions ?? 0}</Td>
                    <Td>{formatDate(user.createdAt)}</Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>

          <Pagination
            page={pagination.page}
            totalPages={pagination.total_pages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
