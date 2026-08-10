import { io, type Socket } from 'socket.io-client';
import { auth } from '../lib/firebase';
import type { ChatMessageComAutor } from '../lib/chat-messages';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://rabbit.tryquibly.com';

/**
 * Quanto tempo um "está digitando" vale sem ser renovado.
 *
 * Tem que ser maior que o intervalo com que o remetente reenvia o aviso, senão
 * o texto pisca enquanto a pessoa digita sem parar. Espelha o TTL do servidor.
 */
export const TYPING_TTL_MS = 4000;

/** Com que frequência o aviso de digitação é reenviado enquanto se digita. */
export const TYPING_PING_MS = 1500;

export interface OuvintesDoChat {
  onMensagem: (mensagem: ChatMessageComAutor) => void;
  onApagada: (id: string) => void;
  /** Alguém começou ou parou de digitar. Nunca o próprio usuário. */
  onDigitando: (userId: string, digitando: boolean) => void;
  onConectado: (conectado: boolean) => void;
}

export interface ConexaoDoChat {
  /** Avisa a sala que este usuário está (ou parou de) digitar. */
  digitando: (digitando: boolean) => void;
  desconectar: () => void;
}

/**
 * A conexão de tempo real de uma sala.
 *
 * ## Por que o token vai no handshake, e não num evento
 *
 * O servidor derruba socket sem identidade. Mandar o token depois, num evento
 * de "auth", deixaria uma janela em que o socket está conectado e não
 * autenticado — e a decisão de o que fazer com os eventos que chegam nessa
 * janela é exatamente o tipo de detalhe que ninguém acerta na pressa.
 *
 * ## Reconexão
 *
 * O socket.io reconecta sozinho, com recuo exponencial. O que ele **não** faz é
 * refazer o `join`: a sala é estado do servidor e some quando o socket cai. Por
 * isso o `join` está amarrado ao evento `connect`, e não a uma chamada única —
 * sem isso o chat reconecta e nunca mais recebe mensagem, que é a pior forma de
 * quebrar, porque parece conectado.
 */
export function conectarAoChat(leagueId: string, ouvintes: OuvintesDoChat): ConexaoDoChat {
  let socket: Socket | null = null;
  let vivo = true;

  void (async () => {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    // Sem token não adianta abrir: o servidor derrubaria, e o socket.io ficaria
    // tentando de novo para sempre contra uma porta que nunca abre.
    if (!vivo || !token) {
      ouvintes.onConectado(false);
      return;
    }

    socket = io(`${API_URL}/chat`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      ouvintes.onConectado(true);
      // Refeito a cada conexão, inclusive nas reconexões.
      socket?.emit('join', { league_id: leagueId });
    });

    socket.on('disconnect', () => ouvintes.onConectado(false));
    socket.on('connect_error', () => ouvintes.onConectado(false));

    socket.on('message', (mensagem: ChatMessageComAutor) => ouvintes.onMensagem(mensagem));
    socket.on('message:deleted', ({ id }: { id: string }) => ouvintes.onApagada(id));
    socket.on('typing', ({ user_id, typing }: { user_id: string; typing: boolean }) =>
      ouvintes.onDigitando(user_id, typing),
    );
  })();

  return {
    digitando: (digitando: boolean) => {
      socket?.emit('typing', { league_id: leagueId, typing: digitando });
    },
    desconectar: () => {
      vivo = false;
      // `leave` antes de fechar para os outros pararem de ver "digitando…".
      socket?.emit('leave', { league_id: leagueId });
      socket?.disconnect();
      socket = null;
    },
  };
}
