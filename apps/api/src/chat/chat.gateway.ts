import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';

/** Quanto tempo um "está digitando" vale sem ser renovado. */
export const TYPING_TTL_MS = 4000;

/** O nome da sala no socket. Prefixado para nunca colidir com o id do socket. */
export const salaDe = (leagueId: string) => `league:${leagueId}`;

interface SocketAutenticado extends Socket {
  data: { userId?: string; salas?: Set<string> };
}

/**
 * O tempo real do chat.
 *
 * ## Por que socket, e não o polling que havia
 *
 * O polling de 3s custava uma busca das 50 últimas mensagens **por usuário, a
 * cada 3 segundos**, e ainda assim entregava a mensagem com até 3s de atraso.
 * Numa sala de 20 pessoas isso é 400 consultas por minuto para, quase sempre,
 * responder "nada mudou".
 *
 * E o "está digitando" não é implementável em cima disso: ele precisa do
 * caminho inverso — o cliente avisando o servidor a cada tecla — e precisa
 * chegar em milissegundos, ou vira um aviso que aparece depois que a pessoa já
 * enviou.
 *
 * ## O que NÃO é persistido
 *
 * `typing` não toca o banco. É estado de interface com validade de segundos, e
 * gravá-lo seria criar registro de comportamento de digitação de usuário — dado
 * novo, sensível e sem finalidade, exatamente o que a LGPD manda evitar.
 *
 * ## Autenticação
 *
 * O mesmo token do Firebase do resto da API, lido do handshake. **A conexão não
 * confia no `userId` que o cliente manda em evento nenhum** — ele é fixado uma
 * vez, na conexão, e todo evento usa o do socket. Sem isso qualquer cliente
 * poderia digitar e falar como outra pessoa.
 *
 * ## Mais de uma instância
 *
 * `server.to(sala)` só alcança quem está conectado *nesta* instância. Hoje o
 * serviço roda sozinho, então funciona. No dia em que escalar, isto precisa do
 * adaptador de Redis do socket.io — e o sintoma, se esquecerem, é cruel: o chat
 * funciona para metade da sala. Fica anotado aqui porque é o único lugar onde a
 * suposição está escrita.
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: SocketAutenticado): Promise<void> {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization as string | undefined)?.replace(
        'Bearer ',
        '',
      );

    if (!token) {
      // Desconectar em vez de tolerar anônimo: um socket sem identidade não tem
      // como ter as salas verificadas, e "conectado mas inútil" só produziria um
      // chat que parece vivo e nunca recebe nada.
      socket.disconnect(true);
      return;
    }

    try {
      const decodificado = await this.firebase.getAuth().verifyIdToken(token);
      socket.data.userId = decodificado.uid;
      socket.data.salas = new Set();
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: SocketAutenticado): void {
    // O socket.io tira o socket das salas sozinho. O que ele não faz é avisar
    // que a pessoa parou de digitar — e sem isto o "fulano está digitando…"
    // ficaria congelado na tela dos outros até o TTL do cliente vencer.
    for (const leagueId of socket.data.salas ?? []) {
      socket.to(salaDe(leagueId)).emit('typing', {
        user_id: socket.data.userId,
        typing: false,
      });
    }
  }

  /**
   * Entrar na sala. **A associação é verificada aqui**, e não no cliente.
   *
   * Sem esta consulta, qualquer um com um token válido escutaria a conversa de
   * qualquer liga só mandando o id dela — o mesmo furo que o `verifyMembership`
   * fecha no lado HTTP.
   */
  @SubscribeMessage('join')
  async entrar(
    @ConnectedSocket() socket: SocketAutenticado,
    @MessageBody() body: { league_id?: string },
  ): Promise<{ ok: boolean }> {
    const userId = socket.data.userId;
    const leagueId = body?.league_id;
    if (!userId || !leagueId) return { ok: false };

    const membro = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      select: { id: true },
    });
    if (!membro) return { ok: false };

    await socket.join(salaDe(leagueId));
    socket.data.salas?.add(leagueId);
    return { ok: true };
  }

  @SubscribeMessage('leave')
  async sair(
    @ConnectedSocket() socket: SocketAutenticado,
    @MessageBody() body: { league_id?: string },
  ): Promise<{ ok: boolean }> {
    const leagueId = body?.league_id;
    if (!leagueId) return { ok: false };

    await socket.leave(salaDe(leagueId));
    socket.data.salas?.delete(leagueId);
    return { ok: true };
  }

  /**
   * "Está digitando", para todo mundo menos quem digitou.
   *
   * `socket.to(...)` exclui o próprio remetente de propósito: ver o próprio
   * aviso é ruído, e o cliente já sabe que está digitando.
   *
   * Só ecoa para sala em que o socket entrou — a checagem de associação foi
   * feita no `join`, e repetir a consulta a cada tecla seria uma ida ao banco
   * por caractere digitado.
   */
  @SubscribeMessage('typing')
  digitando(
    @ConnectedSocket() socket: SocketAutenticado,
    @MessageBody() body: { league_id?: string; typing?: boolean },
  ): void {
    const leagueId = body?.league_id;
    if (!leagueId || !socket.data.salas?.has(leagueId)) return;

    socket.to(salaDe(leagueId)).emit('typing', {
      user_id: socket.data.userId,
      typing: body.typing !== false,
    });
  }

  /**
   * Anuncia uma mensagem nova para a sala. Chamado pelo `ChatService` depois de
   * gravar — nunca a partir de um evento do cliente.
   *
   * Emitir só depois da escrita é o que garante que todo mundo veja a mesma
   * mensagem com o mesmo id: é o id do banco que reconcilia a bolha otimista
   * que o autor já está vendo.
   */
  anunciarMensagem(leagueId: string, mensagem: unknown): void {
    this.server?.to(salaDe(leagueId)).emit('message', mensagem);
  }

  /** Anuncia que uma mensagem foi apagada, para a lápide aparecer na hora. */
  anunciarApagada(leagueId: string, messageId: string): void {
    this.server?.to(salaDe(leagueId)).emit('message:deleted', { id: messageId });
  }
}
