'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LineChart } from '@/components/charts/line-chart';
import { Spinner } from '@/components/ui/spinner';
import { formatNumber } from '@/lib/utils';

/**
 * A visão geral.
 *
 * ## O que estava errado, e não era estético
 *
 * Ela contava documentos, baralhos, quizzes e gerações do dia — o retrato de
 * uma versão anterior do produto. Em 09/08 a captura de aula e a lista de
 * baralhos saíram da tela de estudo do app justamente por **não serem mais o
 * foco**, e esta página continuou medindo o que foi tirado.
 *
 * Painel que mede o produto errado é pior que painel vazio: dá a sensação de
 * que se está acompanhando alguma coisa.
 *
 * ## A ordem agora
 *
 * Primeiro **o que precisa de você** — a fila de denúncias, a única coisa aqui
 * com alguém esperando do outro lado. Depois **o produto vivo**: gente, salas
 * com desafio em andamento, sessões de hoje. Por último o conteúdo de IA, que
 * ainda existe e ainda custa dinheiro, mas não descreve mais o Quibly.
 *
 * ## Por que "salas ativas" e não "salas"
 *
 * Total conta também as que morreram, e sala morta não diz nada sobre o produto
 * estar vivo. O total fica ao lado, pequeno, como referência.
 */

interface AdminStats {
  total_users: number;
  pro_users: number;
  total_documents: number;
  total_flashcard_sets: number;
  total_quizzes: number;
  total_rooms: number;
  active_rooms: number;
  sessions_today: number;
  pending_reports: number;
  banned_users: number;
  generations_today: { flashcard_sets: number; quizzes: number };
}

interface GrowthData {
  signups: { date: string; count: number }[];
  generations: { date: string; flashcard_sets: number; quizzes: number }[];
  activeUsers: { date: string; count: number }[];
}

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });

/**
 * Um número com o seu rótulo.
 *
 * O valor em `tabular-nums` porque a home é lida de relance, e dígito de
 * largura variável faz colunas vizinhas dançarem quando o número muda.
 */
function Numero({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={
        'rounded-xl border p-5 ' +
        (destaque
          ? 'border-quibly-primary/40 bg-quibly-primary/10'
          : 'border-quibly-border bg-quibly-surface')
      }
    >
      <p className="text-[11px] uppercase tracking-[0.14em] text-quibly-text-muted">{rotulo}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-quibly-text">{valor}</p>
      {nota ? <p className="mt-1 text-xs text-quibly-text-muted">{nota}</p> : null}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, g] = await Promise.all([
          api.get<AdminStats>('/admin/stats'),
          api.get<GrowthData>('/admin/growth?days=30'),
        ]);
        setStats(s);
        setGrowth(g);
      } catch (err) {
        /*
         Três causas, três mensagens.

         Isto dizia "Access Denied" para tudo — inclusive para CORS bloqueado e
         API fora do ar. Em 10/08 isso custou horas: o painel acusava permissão
         enquanto o problema era rede, e mandava procurar no único lugar onde o
         defeito não estava. A API já aprendeu a distinguir; a tela também
         precisa.
        */
        const m = err instanceof Error ? err.message : '';
        if (m.includes('403')) setErro('Sua conta não está na lista de administradores.');
        else if (m.includes('Failed to fetch'))
          setErro('Não deu para falar com a API — pode ser rede, CORS ou o serviço fora do ar.');
        else setErro(m || 'Não deu para carregar os números.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <p className="max-w-md text-center text-quibly-text-secondary">{erro}</p>
      </div>
    );
  }

  if (!stats || !growth) return null;

  const cadastros = (growth.signups ?? []).map((d) => ({ date: dataCurta(d.date), count: d.count }));
  const ativos = (growth.activeUsers ?? (growth as never as { active_users?: GrowthData['activeUsers'] }).active_users ?? []).map(
    (d) => ({ date: dataCurta(d.date), count: d.count }),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-quibly-text">Visão geral</h1>
        <p className="mt-1 text-sm text-quibly-text-muted">
          O que precisa de você primeiro, o produto depois.
        </p>
      </div>

      {/* Bloco 1 — pendências. Só aparece quando existe pendência: um cartão
          dizendo "0 denúncias" ocuparia o topo da tela para não informar nada. */}
      {stats.pending_reports > 0 ? (
        <Link
          href="/admin/reports"
          className="flex items-center gap-4 rounded-xl border border-red-500/40 bg-red-500/10 p-5 transition-colors hover:bg-red-500/15"
        >
          <span className="text-3xl font-bold tabular-nums text-red-400">
            {stats.pending_reports}
          </span>
          <span className="flex-1">
            <span className="block font-semibold text-quibly-text">
              {stats.pending_reports === 1 ? 'denúncia esperando' : 'denúncias esperando'}
            </span>
            <span className="block text-sm text-quibly-text-muted">
              Alguém está do outro lado de cada uma.
            </span>
          </span>
          <span className="text-quibly-text-muted">→</span>
        </Link>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-quibly-text-muted">
          O produto hoje
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Numero
            rotulo="Pessoas"
            valor={formatNumber(stats.total_users)}
            nota={`${formatNumber(stats.pro_users)} no Pro`}
          />
          <Numero
            rotulo="Salas ativas"
            valor={formatNumber(stats.active_rooms)}
            nota={`${formatNumber(stats.total_rooms)} no total`}
          />
          <Numero
            rotulo="Sessões hoje"
            valor={formatNumber(stats.sessions_today)}
            destaque
          />
          <Numero
            rotulo="Contas suspensas"
            valor={formatNumber(stats.banned_users)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-quibly-text-muted">
          Crescimento — 30 dias
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LineChart
            title="Cadastros"
            data={cadastros}
            xKey="date"
            lines={[{ key: 'count', color: '#015FFD', label: 'Cadastros' }]}
          />
          <LineChart
            title="Pessoas ativas"
            data={ativos}
            xKey="date"
            lines={[{ key: 'count', color: '#4C9AFF', label: 'Ativas' }]}
          />
        </div>
      </section>

      {/* Bloco 4 — o conteúdo de IA perdeu o topo, e não sumiu: ele ainda existe
          e ainda custa dinheiro. Uma linha discreta em vez de cinco cartões. */}
      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-quibly-text-muted">
          Conteúdo gerado
        </h2>
        <div className="rounded-xl border border-quibly-border bg-quibly-surface p-5">
          <p className="text-sm text-quibly-text-secondary">
            <span className="font-semibold tabular-nums text-quibly-text">
              {formatNumber(stats.total_flashcard_sets)}
            </span>{' '}
            baralhos ·{' '}
            <span className="font-semibold tabular-nums text-quibly-text">
              {formatNumber(stats.total_quizzes)}
            </span>{' '}
            quizzes ·{' '}
            <span className="font-semibold tabular-nums text-quibly-text">
              {formatNumber(stats.total_documents)}
            </span>{' '}
            documentos
          </p>
          <p className="mt-1 text-xs text-quibly-text-muted">
            Hoje: {stats.generations_today.flashcard_sets} baralhos e{' '}
            {stats.generations_today.quizzes} quizzes gerados.
          </p>
        </div>
      </section>
    </div>
  );
}
