import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { conteudo } from '../../components/landing/content';
import { idiomaAceito } from '../../lib/idioma';
import { plataformaDe } from '../../lib/plataforma';
import BotoesDeLoja, { APP_STORE, PLAY_STORE } from '../../components/landing/BotoesDeLoja';

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
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = conteudo.download[idiomaAceito((await headers()).get('accept-language'))];
  return {
    title: `📲 ${t.titulo}`,
    description: t.descricao,
    openGraph: { title: `📲 ${t.titulo}`, description: t.descricao },
  };
}

export default async function DownloadPage() {
  const cabecalhos = await headers();
  const plataforma = plataformaDe(cabecalhos.get('user-agent'));
  const t = conteudo.download[idiomaAceito(cabecalhos.get('accept-language'))];

  if (plataforma === 'ios') redirect(APP_STORE);
  if (plataforma === 'android') redirect(PLAY_STORE);

  return (
    <main className="pagina convite">
      <div className="convite-cartao">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="convite-capa" src="/coelho-convite.jpg" alt="" />

        <div className="convite-corpo">
          <h1 className="display convite-nome">{t.titulo}</h1>

          <p className="convite-descricao">{t.subtitulo}</p>

          <BotoesDeLoja apple={t.appStore} google={t.playStore} centro />
        </div>
      </div>
    </main>
  );
}
