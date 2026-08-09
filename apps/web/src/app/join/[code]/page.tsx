import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { conteudo } from '../../../components/landing/content';
import { idiomaAceito } from '../../../lib/idioma';

/**
 * A página que o convite abre.
 *
 * ## O que estava errado
 *
 * A versão anterior fazia três coisas contra quem chegava:
 *
 * 1. **Disparava o deep link no `useEffect`.** O iOS respondia com o alerta
 *    *"Abrir no Quibly?"* antes da pessoa ter visto nada — um app desconhecido
 *    pedindo para abrir, o que se responde com "Cancelar".
 * 2. **Não dizia qual sala era.** "You've been invited to join a league!" serve
 *    para qualquer convite de qualquer sala. Quem recebe não sabe de quem veio
 *    nem para onde vai, e é essa a decisão que a página existe para apoiar.
 * 3. **Mandava "baixe da App Store" por escrito**, sem link. O único caminho
 *    que interessa — a pessoa não tem o app — era o único sem botão.
 *
 * ## Por que componente de servidor
 *
 * Metade do trabalho de um convite acontece **antes** do toque: no WhatsApp, na
 * prévia do link. Um componente de cliente entrega HTML vazio ao robô que monta
 * essa prévia, e o convite chega como uma URL crua. Buscando no servidor, o
 * `generateMetadata` põe o nome e a capa da sala no cartão.
 *
 * ## Por que o idioma vem do cabeçalho
 *
 * O resto do site escolhe idioma pela rota — `/` e `/pt`. Aqui não dá: o
 * convite é **um link só**, gerado pelo app de quem convida e colado num grupo
 * onde pode ter gente de qualquer lugar. Quem escolhe tem que ser o navegador
 * de quem abre. Ver `lib/idioma`.
 *
 * ## Por que a sala aparece sem login
 *
 * Quem recebe convite é justamente quem não tem conta. `GET /invite/:code` é a
 * única rota aberta da API, e devolve só o que esta página desenha — ver
 * `convite-publico.controller.ts`.
 */

interface Convite {
  name: string;
  description: string | null;
  cover_url: string | null;
  owner: { username: string; avatar_url: string | null };
  member_count: number;
  is_full: boolean;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const APP_STORE = 'https://apps.apple.com/app/id6760320166';

async function buscarConvite(code: string): Promise<Convite | null> {
  try {
    const res = await fetch(`${API}/invite/${encodeURIComponent(code)}`, {
      // O convite é estável, mas não eterno: o nome e a capa da sala mudam, e
      // um minuto é curto o bastante para ninguém receber um cartão de link
      // desatualizado, e longo o bastante para um convite viral não virar
      // carga na API.
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Convite;
  } catch {
    // A API fora do ar não pode virar erro 500 aqui. Sem os dados a página
    // ainda cumpre o essencial: leva à App Store e mostra o código.
    return null;
  }
}

async function idiomaDaVisita() {
  return idiomaAceito((await headers()).get('accept-language'));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const convite = await buscarConvite(code);
  if (!convite) return { title: 'Quibly' };

  const t = conteudo.convite[await idiomaDaVisita()];
  const titulo = t.tituloDaPrevia(convite.owner.username, convite.name);
  return {
    title: titulo,
    description: t.descricaoDoSite,
    openGraph: {
      title: titulo,
      description: convite.description ?? t.previaTexto,
      images: convite.cover_url ? [convite.cover_url] : undefined,
    },
  };
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const convite = await buscarConvite(code);
  const t = conteudo.convite[await idiomaDaVisita()];
  const deepLink = `quibly://league/join/${encodeURIComponent(code)}`;

  return (
    <main className="pagina convite">
      <div className="convite-cartao">
        {convite?.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="convite-capa" src={convite.cover_url} alt="" />
        ) : (
          // A capa da sala vem primeiro; o coelho só entra quando a sala não
          // tem foto. Um convite sem imagem nenhuma some no meio da conversa.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="convite-capa" src="/coelho-convite.jpg" alt="" />
        )}

        <div className="convite-corpo">
          <h1 className="display convite-nome">{convite?.name ?? t.salaSemNome}</h1>

          {convite ? (
            <p className="convite-linha">
              {convite.owner.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="convite-rosto" src={convite.owner.avatar_url} alt="" />
              ) : null}
              {/* A frase inteira vem do dicionário, e não "nome + sufixo":
                  em inglês o verbo vem depois do nome, em outras línguas não, e
                  costurar pedaço de frase em código quebra na primeira tradução
                  que não for parecida com a nossa. */}
              <span>{t.convidou(convite.owner.username)}</span>
            </p>
          ) : null}

          {convite?.description ? (
            <p className="convite-descricao">{convite.description}</p>
          ) : null}

          {convite ? (
            <p className="convite-meta">
              {t.pessoas(convite.member_count)}
              {convite.is_full ? t.cheia : ''}
            </p>
          ) : null}

          {/* A App Store primeiro, e não o "abrir no app". Quem chega por um
              convite quase nunca tem o Quibly instalado — e o botão de abrir,
              para essa pessoa, é o que não faz nada. */}
          <a className="btn btn-primario btn-grande convite-botao" href={APP_STORE}>
            {t.baixar}
          </a>
          <a className="btn btn-fantasma convite-botao" href={deepLink}>
            {t.jaTenho}
          </a>

          <p className="convite-codigo">
            {t.codigo} <span className="mono">{code}</span>
          </p>
        </div>
      </div>
    </main>
  );
}
