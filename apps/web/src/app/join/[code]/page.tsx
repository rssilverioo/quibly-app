import type { Metadata } from 'next';

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const convite = await buscarConvite(code);
  if (!convite) return { title: 'Quibly' };

  const titulo = `${convite.owner.username} convidou você para ${convite.name}`;
  return {
    title: titulo,
    description: 'Salas de estudo que contam os dias em que você aparece.',
    openGraph: {
      title: titulo,
      description: convite.description ?? 'Entre na sala e comece a contar os seus dias.',
      images: convite.cover_url ? [convite.cover_url] : undefined,
    },
  };
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const convite = await buscarConvite(code);
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
          <h1 className="display convite-nome">{convite?.name ?? 'Uma sala no Quibly'}</h1>

          {convite ? (
            <p className="convite-linha">
              {convite.owner.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="convite-rosto" src={convite.owner.avatar_url} alt="" />
              ) : null}
              <span>
                <strong>{convite.owner.username}</strong> convidou você
              </span>
            </p>
          ) : null}

          {convite?.description ? (
            <p className="convite-descricao">{convite.description}</p>
          ) : null}

          {convite ? (
            <p className="convite-meta">
              {convite.member_count === 1
                ? '1 pessoa estudando aqui'
                : `${convite.member_count} pessoas estudando aqui`}
              {convite.is_full ? ' · sala cheia' : ''}
            </p>
          ) : null}

          {/* A App Store primeiro, e não o "abrir no app". Quem chega por um
              convite quase nunca tem o Quibly instalado — e o botão de abrir,
              para essa pessoa, é o que não faz nada. */}
          <a className="btn btn-primario btn-grande convite-botao" href={APP_STORE}>
            Baixar o Quibly
          </a>
          <a className="btn btn-fantasma convite-botao" href={deepLink}>
            Já tenho o app
          </a>

          <p className="convite-codigo">
            Código da sala <span className="mono">{code}</span>
          </p>
        </div>
      </div>
    </main>
  );
}
