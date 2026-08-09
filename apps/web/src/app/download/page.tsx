import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { conteudo } from '../../components/landing/content';
import { idiomaAceito } from '../../lib/idioma';
import { plataformaDe } from '../../lib/plataforma';

/**
 * `tryquibly.com/download` — o link único da bio do Instagram.
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
 * ## O estado "sem loja" continua no código
 *
 * `PLAY_STORE` é anulável e a página trata o caso de ele faltar, embora hoje
 * esteja preenchido. Não é adorno: mandar alguém para uma listagem que responde
 * "não encontrado" é pior que não ter botão — quem chega assim conclui que o app
 * não existe. Se a listagem sair do ar, o caminho degradado já está escrito.
 */

const APP_STORE = 'https://apps.apple.com/app/id6760320166';

/** A listagem do Android. Publicada — a versão de lá é que está atrasada. */
const PLAY_STORE: string | null =
  'https://play.google.com/store/apps/details?id=com.quibly.app';

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
  if (plataforma === 'android' && PLAY_STORE) redirect(PLAY_STORE);

  const androidSemLoja = plataforma === 'android';

  return (
    <main className="pagina convite">
      <div className="convite-cartao">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="convite-capa" src="/coelho-convite.jpg" alt="" />

        <div className="convite-corpo">
          <h1 className="display convite-nome">{t.titulo}</h1>

          {androidSemLoja ? (
            <>
              <p className="convite-linha">
                <strong>{t.androidEmBreve}</strong>
              </p>
              <p className="convite-descricao">{t.androidTexto}</p>
            </>
          ) : (
            <p className="convite-descricao">{t.subtitulo}</p>
          )}

          <a className="btn btn-primario btn-grande convite-botao" href={APP_STORE}>
            {t.appStore}
          </a>

          {/* O botão da Play só aparece quando há para onde ir. Um botão
              desabilitado ocuparia o mesmo espaço para não fazer nada. */}
          {PLAY_STORE ? (
            <a className="btn btn-fantasma convite-botao" href={PLAY_STORE}>
              {t.playStore}
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}
