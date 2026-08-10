'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { StatCard } from '@/components/charts/stat-card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { formatDate, formatNumber } from '@/lib/utils';

interface RevenueData {
  proUsers: number;
  freeUsers: number;
  planBreakdown: { platform: string | null; count: number }[];
  subscriptionStatuses: { subscriptionStatus: string | null; _count: { _all: number } }[];
  recentSubscriptions: Array<{
    id: string;
    email: string;
    username: string;
    subscriptionPlatform: string | null;
    subscriptionStatus: string | null;
    currentPeriodEnd: string | null;
    createdAt: string;
  }>;
}

function getStatusVariant(status: string | null): 'success' | 'error' | 'warning' {
  if (status === 'active') return 'success';
  if (status === 'canceled' || status === 'past_due') return 'error';
  return 'warning';
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await api.get<RevenueData>('/admin/revenue');
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não deu para carregar revenue data');
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
          <p className="text-quibly-error text-lg font-medium mb-2">Erro</p>
          <p className="text-quibly-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-quibly-text">Receita</h1>
        <p className="mt-1 text-sm text-quibly-text-muted">Quem assina, por qual plataforma, e quando vence.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="No Pro" value={formatNumber(data.proUsers)} />
        <StatCard title="No plano grátis" value={formatNumber(data.freeUsers)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold text-quibly-text mb-4">Distribuição por plano</h2>
          <Table>
            <Thead>
              <Tr>
                <Th>Plataforma</Th>
                <Th>Users</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.planBreakdown.map((plan, i) => (
                <Tr key={i}>
                  <Td className="font-mono text-xs">
                    {plan.platform ?? 'N/A'}
                  </Td>
                  <Td>{plan.count}</Td>
                </Tr>
              ))}
              {data.planBreakdown.length === 0 && (
                <Tr>
                  <Td colSpan={2} className="text-center text-quibly-text-muted">
                    No plan data available
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-quibly-text mb-4">Situação da assinatura</h2>
          <Table>
            <Thead>
              <Tr>
                <Th>Situação</Th>
                <Th>Quantidade</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.subscriptionStatuses.map((s, i) => (
                <Tr key={i}>
                  <Td>
                    <Badge variant={getStatusVariant(s.subscriptionStatus)}>
                      {s.subscriptionStatus ?? 'N/A'}
                    </Badge>
                  </Td>
                  <Td>{s._count._all}</Td>
                </Tr>
              ))}
              {data.subscriptionStatuses.length === 0 && (
                <Tr>
                  <Td colSpan={2} className="text-center text-quibly-text-muted">
                    No status data available
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-quibly-text mb-4">Assinaturas recentes</h2>
        <Table>
          <Thead>
            <Tr>
              <Th>Pessoa</Th>
              <Th>E-mail</Th>
              <Th>Plataforma</Th>
              <Th>Situação</Th>
              <Th>Vence em</Th>
              <Th>Entrou em</Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.recentSubscriptions.map((sub) => (
              <Tr key={sub.id}>
                <Td className="font-medium text-quibly-text">{sub.username}</Td>
                <Td>{sub.email}</Td>
                <Td className="font-mono text-xs">{sub.subscriptionPlatform ?? 'N/A'}</Td>
                <Td>
                  <Badge variant={getStatusVariant(sub.subscriptionStatus)}>
                    {sub.subscriptionStatus ?? 'N/A'}
                  </Badge>
                </Td>
                <Td>
                  {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : 'N/A'}
                </Td>
                <Td>{formatDate(sub.createdAt)}</Td>
              </Tr>
            ))}
            {data.recentSubscriptions.length === 0 && (
              <Tr>
                <Td colSpan={6} className="text-center text-quibly-text-muted">
                  No recent subscriptions
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
