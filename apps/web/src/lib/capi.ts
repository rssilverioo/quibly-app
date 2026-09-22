import { randomUUID } from 'node:crypto';

import { PIXEL_ID } from './pixel';

/**
 * A API de Conversões da Meta — o pixel visto do servidor.
 *
 * ## Por que existe, se o pixel já está na página
 *
 * O `/download` redireciona iPhone e Android para a loja **no servidor**,
 * antes de qualquer HTML. Nenhum script roda, o pixel nunca dispara, e é
 * justamente esse o acesso que vem do anúncio no celular. Aqui o servidor
 * conta esse acesso e o clique implícito na loja, com o mesmo IP, o mesmo
 * User-Agent e o mesmo cookie `_fbc`/`_fbp` que o pixel usaria — é o que a
 * Meta precisa para casar o evento com a pessoa.
 *
 * ## Onde entra o token
 *
 * `META_CAPI_TOKEN`, variável de ambiente da hospedagem. Nunca no código:
 * o token dá acesso de escrita ao pixel. Sem ele, esta função não faz nada,
 * e o site funciona igual — a medição é o que se perde, não o redirecionamento.
 *
 * `META_TEST_EVENT_CODE`, opcional, faz os eventos aparecerem na aba
 * "Testar eventos" do Gerenciador em vez de entrar na contagem real.
 *
 * ## Por que não bloqueia a resposta
 *
 * Quem chama passa um `Promise` a `after()` do Next: o redirecionamento sai
 * primeiro, a chamada à Meta acontece depois. Erro aqui é engolido de
 * propósito — um pixel fora do ar não pode segurar uma pessoa que quer
 * baixar o app.
 */
type Evento = {
  nome: string;
  url: string;
  ip: string | null;
  userAgent: string | null;
  cookies: string | null;
  parametros?: Record<string, string>;
};

function cookie(cookies: string | null, nome: string): string | undefined {
  if (!cookies) return undefined;
  const par = cookies.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${nome}=`));
  return par ? decodeURIComponent(par.slice(nome.length + 1)) : undefined;
}

export async function enviarEventosCapi(eventos: Evento[]): Promise<void> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token || !PIXEL_ID || eventos.length === 0) return;

  const agora = Math.floor(Date.now() / 1000);
  const corpo: Record<string, unknown> = {
    data: eventos.map((e) => ({
      event_name: e.nome,
      event_time: agora,
      event_id: randomUUID(),
      event_source_url: e.url,
      action_source: 'website',
      user_data: {
        client_ip_address: e.ip ?? undefined,
        client_user_agent: e.userAgent ?? undefined,
        fbc: cookie(e.cookies, '_fbc'),
        fbp: cookie(e.cookies, '_fbp'),
      },
      custom_data: e.parametros,
    })),
  };
  const teste = process.env.META_TEST_EVENT_CODE;
  if (teste) corpo.test_event_code = teste;

  try {
    await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Medição perdida, redirecionamento intacto.
  }
}
