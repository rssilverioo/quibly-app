'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/utils';

/**
 * A fila de denúncias.
 *
 * ## Por que esta página existe
 *
 * A tabela `content_reports` era escrita desde sempre e **nunca lida**. O app
 * oferecia denunciar, a linha entrava no banco e morria ali. Além do problema
 * óbvio — ninguém nunca soube de nada —, é exigência do Guideline 1.2 da Apple:
 * ter o botão sem ter o outro lado é motivo de reprovação.
 *
 * ## O que ela mostra, e o que não mostra
 *
 * A **prova fotografada no instante da denúncia**, não o conteúdo ao vivo. Quem
 * é denunciado apaga a mensagem em dois toques; se a página lesse o conteúdo
 * atual, apagar seria o caminho para escapar.
 *
 * E mostra **só o que foi denunciado**. Não há como abrir a conversa em volta.
 * Salas são grupos privados de estudo, e a diferença entre "temos moderação" e
 * "lemos as conversas dos usuários" é exatamente essa linha — decisão do dono
 * do produto em 09/08.
 */

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  snapshotText: string | null;
  snapshotAuthorName: string | null;
  snapshotAt: string | null;
  snapshotRoomId: string | null;
  reviewNote: string | null;
  reporter: { id: string; username: string; handle: string } | null;
  author: { id: string; username: string; handle: string; bannedAt: string | null } | null;
}

const FILAS = ['PENDING', 'REVIEWED', 'DISMISSED', 'ALL'] as const;

const MOTIVO: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Assédio',
  nudity: 'Nudez',
  violence: 'Violência',
  other: 'Outro',
};

const TIPO: Record<string, string> = {
  chat_message: 'Mensagem',
  post: 'Post',
  comment: 'Comentário',
  profile: 'Perfil',
};

export default function ReportsPage() {
  const [fila, setFila] = useState<(typeof FILAS)[number]>('PENDING');
  const [reports, setReports] = useState<Report[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [agindo, setAgindo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api.get<{ reports: Report[] }>(`/admin/reports?status=${fila}`);
      setReports(r.reports ?? []);
    } finally {
      setCarregando(false);
    }
  }, [fila]);

  useEffect(() => { void carregar(); }, [carregar]);

  const julgar = async (id: string, status: 'REVIEWED' | 'DISMISSED') => {
    setAgindo(id);
    try {
      await api.patch(`/admin/reports/${id}`, { status });
      await carregar();
    } finally {
      setAgindo(null);
    }
  };

  /**
   * Suspender pede o motivo antes de aplicar.
   *
   * Não é burocracia: quem abrir esta fila daqui a três meses precisa entender
   * a decisão sem adivinhar, e quem está prestes a suspender alguém se beneficia
   * de ter que escrever por quê. Cancelar o prompt cancela a ação.
   */
  const suspender = async (userId: string, banir: boolean) => {
    const motivo = banir ? window.prompt('Motivo da suspensão (fica registrado):') : null;
    if (banir && !motivo?.trim()) return;
    setAgindo(userId);
    try {
      await api.patch(`/admin/users/${userId}/ban`, { banned: banir, reason: motivo ?? undefined });
      await carregar();
    } finally {
      setAgindo(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Denúncias</h1>
        <div className="flex gap-2">
          {FILAS.map((f) => (
            <button
              key={f}
              onClick={() => setFila(f)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                fila === f ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {f === 'PENDING' ? 'Abertas' : f === 'REVIEWED' ? 'Resolvidas' : f === 'DISMISSED' ? 'Arquivadas' : 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <Spinner />
      ) : reports.length === 0 ? (
        <Card className="p-8 text-center text-gray-400">
          Nada aqui. {fila === 'PENDING' ? 'Nenhuma denúncia aberta.' : 'Nenhuma denúncia nesta fila.'}
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <Card key={r.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">{MOTIVO[r.reason] ?? r.reason}</Badge>
                <Badge>{TIPO[r.targetType] ?? r.targetType}</Badge>
                {r.author?.bannedAt ? <Badge variant="error">Autor suspenso</Badge> : null}
                <span className="ml-auto text-xs text-gray-500">{formatDate(r.createdAt)}</span>
              </div>

              {/* A prova. `snapshotText` vazio quer dizer que o conteúdo já não
                  existia quando a denúncia chegou — a linha continua julgável
                  pelo motivo e por quem denunciou. */}
              <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                {r.snapshotText ? (
                  <p className="whitespace-pre-wrap text-sm text-gray-200">{r.snapshotText}</p>
                ) : (
                  <p className="text-sm italic text-gray-500">
                    Sem cópia do conteúdo — ele já não existia quando a denúncia foi registrada.
                  </p>
                )}
                <p className="mt-3 text-xs text-gray-500">
                  {r.snapshotAuthorName ? `de ${r.snapshotAuthorName}` : 'autor desconhecido'}
                  {r.snapshotAt ? ` · ${formatDate(r.snapshotAt)}` : ''}
                </p>
              </div>

              {r.details ? (
                <p className="text-sm text-gray-400">
                  <span className="text-gray-500">Quem denunciou escreveu:</span> {r.details}
                </p>
              ) : null}

              <p className="text-xs text-gray-500">
                Denunciado por {r.reporter ? `@${r.reporter.handle}` : 'conta removida'}
              </p>

              {r.status === 'PENDING' ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    disabled={agindo === r.id}
                    onClick={() => void julgar(r.id, 'REVIEWED')}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-50"
                  >
                    Resolver
                  </button>
                  <button
                    disabled={agindo === r.id}
                    onClick={() => void julgar(r.id, 'DISMISSED')}
                    className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-50"
                  >
                    Arquivar
                  </button>
                  {r.author ? (
                    <button
                      disabled={agindo === r.author.id}
                      onClick={() => void suspender(r.author!.id, !r.author!.bannedAt)}
                      className={`ml-auto rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 ${
                        r.author.bannedAt
                          ? 'bg-white/10 hover:bg-white/20'
                          : 'bg-red-600/80 hover:bg-red-600'
                      }`}
                    >
                      {r.author.bannedAt ? 'Reativar conta' : 'Suspender conta'}
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  {r.status === 'REVIEWED' ? 'Resolvida' : 'Arquivada'}
                  {r.reviewNote ? ` — ${r.reviewNote}` : ''}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
