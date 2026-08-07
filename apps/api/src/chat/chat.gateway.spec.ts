import { ChatGateway, salaDe } from './chat.gateway';

const makeFirebase = (uid: string | null = 'u1') => ({
  getAuth: () => ({
    verifyIdToken: jest.fn(async () => {
      if (!uid) throw new Error('token inválido');
      return { uid };
    }),
  }),
});

const makePrisma = (membro: unknown = { id: 'membro-1' }) => ({
  leagueMember: { findUnique: jest.fn().mockResolvedValue(membro) },
});

function makeSocket(token?: string) {
  const emitidos: { sala: string; evento: string; payload: unknown }[] = [];
  const socket: any = {
    handshake: { auth: token ? { token } : {}, headers: {} },
    data: {},
    disconnect: jest.fn(),
    join: jest.fn(async () => {}),
    leave: jest.fn(async () => {}),
    to: (sala: string) => ({
      emit: (evento: string, payload: unknown) => emitidos.push({ sala, evento, payload }),
    }),
  };
  return { socket, emitidos };
}

const makeGateway = (firebase: any = makeFirebase(), prisma: any = makePrisma()) =>
  new ChatGateway(firebase as any, prisma as any);

/**
 * Um socket sem identidade não tem como ter as salas verificadas. Aceitá-lo
 * produziria um chat que parece conectado e nunca recebe nada.
 */
describe('handleConnection', () => {
  it('derruba quem chega sem token', async () => {
    const { socket } = makeSocket();

    await makeGateway().handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.data.userId).toBeUndefined();
  });

  it('derruba quem chega com token inválido', async () => {
    const { socket } = makeSocket('token-podre');

    await makeGateway(makeFirebase(null)).handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('fixa o userId a partir do token, e não do que o cliente disser', async () => {
    const { socket } = makeSocket('bom');

    await makeGateway().handleConnection(socket);

    expect(socket.data.userId).toBe('u1');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });
});

/**
 * **O furo que este teste fecha:** sem a consulta de associação, qualquer um com
 * um token válido escutaria a conversa de qualquer liga só mandando o id dela.
 */
describe('join — a associação é verificada no servidor', () => {
  it('recusa entrar em sala de que o usuário não participa', async () => {
    const { socket } = makeSocket('bom');
    const gateway = makeGateway(makeFirebase(), makePrisma(null));
    await gateway.handleConnection(socket);

    const resposta = await gateway.entrar(socket, { league_id: 'sala-alheia' });

    expect(resposta).toEqual({ ok: false });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('entra quando é membro', async () => {
    const { socket } = makeSocket('bom');
    const gateway = makeGateway();
    await gateway.handleConnection(socket);

    const resposta = await gateway.entrar(socket, { league_id: 'sala-1' });

    expect(resposta).toEqual({ ok: true });
    expect(socket.join).toHaveBeenCalledWith(salaDe('sala-1'));
  });

  it('recusa sem sala, sem ir ao banco', async () => {
    const { socket } = makeSocket('bom');
    const prisma = makePrisma();
    const gateway = makeGateway(makeFirebase(), prisma);
    await gateway.handleConnection(socket);

    expect(await gateway.entrar(socket, {})).toEqual({ ok: false });
    expect(prisma.leagueMember.findUnique).not.toHaveBeenCalled();
  });
});

describe('typing', () => {
  async function conectadoNaSala() {
    const { socket, emitidos } = makeSocket('bom');
    const gateway = makeGateway();
    await gateway.handleConnection(socket);
    await gateway.entrar(socket, { league_id: 'sala-1' });
    return { socket, emitidos, gateway };
  }

  it('ecoa para a sala com a identidade do socket', async () => {
    const { socket, emitidos, gateway } = await conectadoNaSala();

    // O cliente manda um `user_id` mentiroso de propósito: ele tem que ser
    // ignorado, senão qualquer um digita como outra pessoa.
    gateway.digitando(socket, { league_id: 'sala-1', typing: true, user_id: 'vitima' } as any);

    expect(emitidos).toEqual([
      { sala: salaDe('sala-1'), evento: 'typing', payload: { user_id: 'u1', typing: true } },
    ]);
  });

  it('não ecoa para sala em que o socket não entrou', async () => {
    const { socket, emitidos, gateway } = await conectadoNaSala();

    gateway.digitando(socket, { league_id: 'outra-sala', typing: true });

    // A checagem de associação foi feita no `join`; repeti-la a cada tecla
    // seria uma ida ao banco por caractere digitado.
    expect(emitidos).toHaveLength(0);
  });

  it('avisa que parou de digitar quando o socket cai', async () => {
    const { socket, emitidos, gateway } = await conectadoNaSala();

    gateway.handleDisconnect(socket);

    // Sem isto, "fulano está digitando…" fica congelado na tela dos outros.
    expect(emitidos).toEqual([
      { sala: salaDe('sala-1'), evento: 'typing', payload: { user_id: 'u1', typing: false } },
    ]);
  });
});
