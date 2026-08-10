'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * A navegação do painel.
 *
 * ## Por que grupos, e não uma lista
 *
 * Eram sete destinos com o mesmo peso, cada um com um emoji. Uma lista plana
 * diz que tudo ali é igualmente urgente — e não é: **denúncia tem alguém
 * esperando do outro lado**, receita se olha uma vez por dia, e a busca de um
 * usuário só acontece quando alguém pergunta.
 *
 * Os três grupos são os três motivos de abrir o painel, e o rótulo de cada um é
 * o verbo: agir, acompanhar, consultar.
 *
 * ## Por que sem emoji
 *
 * Emoji num painel operacional envelhece mal e não escala: 📊 e 📚 não se
 * distinguem de relance, e a fila que importa (🚩) ficava com o mesmo peso
 * visual do resto. A hierarquia agora vem de posição e de um único ponto de
 * cor — o contador de pendências, que é a única informação que muda sozinha.
 *
 * ## Por que português
 *
 * O painel é operado por quem fala português, num produto cuja marca fala
 * português. "Leagues" era, além de inglês, o nome antigo de "salas".
 */

interface Destino {
  href: string;
  label: string;
  /** Nome do campo em `/admin/stats` que vira o contador ao lado. */
  contador?: 'pending_reports';
}

const GRUPOS: { titulo: string; itens: Destino[] }[] = [
  {
    titulo: 'Agir',
    itens: [
      { href: '/admin/reports', label: 'Denúncias', contador: 'pending_reports' },
      { href: '/admin/notifications', label: 'Notificações' },
    ],
  },
  {
    titulo: 'Acompanhar',
    itens: [
      { href: '/admin', label: 'Visão geral' },
      { href: '/admin/revenue', label: 'Receita' },
    ],
  },
  {
    titulo: 'Consultar',
    itens: [
      { href: '/admin/users', label: 'Pessoas' },
      { href: '/admin/leagues', label: 'Salas' },
      { href: '/admin/content', label: 'Conteúdo' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  /**
   * A barra busca o próprio contador.
   *
   * A alternativa era o layout buscar e passar por prop — e o layout é
   * componente de servidor, que não tem o token de quem está logado. Buscar
   * aqui mantém a barra autossuficiente e o layout ignorante, que é o certo:
   * ele não deveria saber que existe uma fila de denúncias.
   *
   * Falha em silêncio de propósito. Sem o número, a barra continua navegando —
   * e navegar é o trabalho dela. Um erro visível aqui apareceria em todas as
   * páginas ao mesmo tempo.
   */
  const [pendencias, setPendencias] = useState(0);
  useEffect(() => {
    api
      .get<{ pending_reports?: number }>('/admin/stats')
      .then((s) => setPendencias(s.pending_reports ?? 0))
      .catch(() => {});
  }, [pathname]);

  return (
    <aside className="w-60 bg-quibly-surface border-r border-quibly-border min-h-screen flex flex-col">
      <div className="px-6 py-7">
        <h1 className="text-lg font-bold text-quibly-text tracking-tight">Quibly</h1>
        <p className="text-[11px] uppercase tracking-[0.18em] text-quibly-text-muted mt-1">
          Painel
        </p>
      </div>

      <nav className="flex-1 px-3 pb-6 space-y-7">
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo}>
            <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.16em] text-quibly-text-muted">
              {grupo.titulo}
            </p>
            <div className="space-y-0.5">
              {grupo.itens.map((item) => {
                const ativo =
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(item.href);
                const conta = item.contador === 'pending_reports' ? pendencias : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      ativo
                        ? 'bg-quibly-primary/15 text-quibly-primary-light font-semibold'
                        : 'text-quibly-text-secondary hover:bg-quibly-surface-light hover:text-quibly-text',
                    )}
                  >
                    <span className="flex-1">{item.label}</span>
                    {/* O único ponto de cor da barra, e ele só existe quando há
                        o que fazer. Um contador em zero seria decoração. */}
                    {conta > 0 ? (
                      <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                        {conta > 99 ? '99+' : conta}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
