import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { conteudo } from '../../components/landing/content';
import { plataformaDe } from '../../lib/plataforma';
import { APP_STORE, PLAY_STORE } from '../../components/landing/BotoesDeLoja';
import PaginaDownload from '../../components/download/PaginaDownload';

/**
 * `quibly.com.br/download` — o link único da bio do Instagram.
 *
 * ## O que ela resolve
 *
 * A bio aceita **um** link, e o público está nos dois sistemas. Aqui o aparelho
 * decide o destino: iPhone vai direto para a App Store, Android para a Play, e
 * computador vê as duas opções.
 *
 * ## Por que redireciona no servidor
 *
 * A alternativa é detectar no cliente, e ela custa um quadro de página em branco
 * antes do salto. No navegador embutido do Instagram — que é por onde quase todo
 * mundo vai chegar — esse quadro é lento o bastante para ser a experiência
 * inteira. Lendo o `User-Agent`, a resposta já sai como redirecionamento.
 *
 * ## Por que o robô não é redirecionado
 *
 * O robô que monta a prévia do link precisa **ver** a página para tirar dela o
 * título e a descrição do cartão. Ele não se declara iPhone nem Android, então
 * cai na página de escolha — que é exatamente o que se quer mostrar num cartão.
 *
 * As duas lojas estão publicadas (22/09/2026); os links moram em
 * `BotoesDeLoja`, junto com os do resto do site, para não haver duas URLs
 * da mesma listagem.
 *
 * ## Por que em português, fixo
 *
 * Diferente do convite, este link é **nosso**: vai na bio do Instagram, que é
 * em português, para um público brasileiro. Segue a raiz do site, que também
 * é pt-BR sem olhar o navegador. Quem fala inglês tem `/en`.
 */

export function generateMetadata(): Metadata {
  const t = conteudo.download.pt;
  return {
    title: `📲 ${t.titulo}`,
    description: t.descricao,
    openGraph: { title: `📲 ${t.titulo}`, description: t.descricao },
  };
}

export default async function DownloadPage() {
  const cabecalhos = await headers();
  const plataforma = plataformaDe(cabecalhos.get('user-agent'));

  if (plataforma === 'ios') redirect(APP_STORE);
  if (plataforma === 'android') redirect(PLAY_STORE);

  return <PaginaDownload lang="pt" />;
}
