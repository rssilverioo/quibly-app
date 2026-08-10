import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HeartbeatController,
  type HeartbeatOptions,
  type HeartbeatSnapshot,
} from './heartbeat';
import { ApiError, NetworkError } from './http-errors';

const INTERVAL = 30_000;
const GRACE = 5 * 60_000;

const snapshot = (elapsedSeconds = 60): HeartbeatSnapshot => ({
  elapsedSeconds,
  status: 'active',
  serverTime: new Date().toISOString(),
});

function makeController(overrides: Partial<HeartbeatOptions> = {}) {
  const send = vi.fn().mockResolvedValue(snapshot());
  const onTick = vi.fn();
  const onGraceExpired = vi.fn();
  const onSessionGone = vi.fn();

  const controller = new HeartbeatController({
    sessionId: 'session-1',
    send,
    onTick,
    onGraceExpired,
    onSessionGone,
    intervalMs: INTERVAL,
    graceMs: GRACE,
    ...overrides,
  });

  return { controller, send, onTick, onGraceExpired, onSessionGone };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HeartbeatController', () => {
  it('beats immediately on start rather than waiting out the first interval', async () => {
    const { controller, send } = makeController();

    controller.start();
    await vi.advanceTimersByTimeAsync(0);

    // A session started and backgrounded within 30s would otherwise have no
    // beat on record at all.
    expect(send).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it('keeps beating on the interval', async () => {
    const { controller, send } = makeController();

    controller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);

    expect(send).toHaveBeenCalledTimes(4);
    controller.stop();
  });

  it('hands the server elapsed count to onTick — it never computes one', async () => {
    const { controller, send, onTick } = makeController();
    send.mockResolvedValue(snapshot(1234));

    controller.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(onTick).toHaveBeenCalledWith(expect.objectContaining({ elapsedSeconds: 1234 }));
    controller.stop();
  });

  it('stops beating after stop()', async () => {
    const { controller, send } = makeController();

    controller.start();
    await vi.advanceTimersByTimeAsync(0);
    controller.stop();
    await vi.advanceTimersByTimeAsync(INTERVAL * 5);

    expect(send).toHaveBeenCalledTimes(1);
  });

  describe('bad network', () => {
    it('retries a dropped beat instead of losing the session', async () => {
      const { controller, send } = makeController();
      send
        .mockRejectedValueOnce(new NetworkError(new Error('offline')))
        .mockResolvedValue(snapshot());

      controller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(send).toHaveBeenCalledTimes(1);

      // Backs off ~2s, then lands.
      await vi.advanceTimersByTimeAsync(2_000);
      expect(send).toHaveBeenCalledTimes(2);
      controller.stop();
    });

    it('backs off exponentially while the signal is down', async () => {
      const { controller, send } = makeController();
      send.mockRejectedValue(new NetworkError(new Error('offline')));

      controller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(send).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2_000); // 2s
      expect(send).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(4_000); // 4s
      expect(send).toHaveBeenCalledTimes(3);

      await vi.advanceTimersByTimeAsync(8_000); // 8s
      expect(send).toHaveBeenCalledTimes(4);

      controller.stop();
    });

    it('resets the backoff once a beat lands, so one bad patch does not slow the next', async () => {
      const { controller, send } = makeController();
      send
        .mockRejectedValueOnce(new NetworkError(new Error('offline')))
        .mockRejectedValueOnce(new NetworkError(new Error('offline')))
        .mockResolvedValueOnce(snapshot())
        .mockRejectedValue(new NetworkError(new Error('offline')));

      controller.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(4_000); // third call lands
      expect(send).toHaveBeenCalledTimes(3);

      // Next scheduled beat is a full interval away, and its failure backs off
      // from 2s again — not from where the previous streak left off.
      await vi.advanceTimersByTimeAsync(INTERVAL);
      expect(send).toHaveBeenCalledTimes(4);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(send).toHaveBeenCalledTimes(5);

      controller.stop();
    });

    it('gives up once the grace window has passed — the session is already swept', async () => {
      const { controller, send, onGraceExpired } = makeController();
      send.mockRejectedValue(new NetworkError(new Error('offline')));

      controller.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(GRACE + 60_000);

      expect(onGraceExpired).toHaveBeenCalledTimes(1);
      expect(controller.isRunning).toBe(false);

      const callsAtGiveUp = send.mock.calls.length;
      await vi.advanceTimersByTimeAsync(INTERVAL * 10);
      // No more battery burn on a session that can no longer be saved.
      expect(send).toHaveBeenCalledTimes(callsAtGiveUp);
    });

    it('retries a 500 — a server fault is transient', async () => {
      const { controller, send } = makeController();
      send
        .mockRejectedValueOnce(new ApiError(500, 'boom'))
        .mockResolvedValue(snapshot());

      controller.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(2_000);

      expect(send).toHaveBeenCalledTimes(2);
      controller.stop();
    });

    it('retries a 429 rather than treating rate limiting as fatal', async () => {
      const { controller, send } = makeController();
      send.mockRejectedValueOnce(new ApiError(429, 'slow down')).mockResolvedValue(snapshot());

      controller.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(2_000);

      expect(send).toHaveBeenCalledTimes(2);
      controller.stop();
    });
  });

  describe('session gone', () => {
    it('stops immediately on a 404 — retrying cannot resurrect it', async () => {
      const { controller, send, onSessionGone } = makeController();
      send.mockRejectedValue(new ApiError(404, 'Session not found'));

      controller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(onSessionGone).toHaveBeenCalledTimes(1);
      expect(controller.isRunning).toBe(false);

      await vi.advanceTimersByTimeAsync(INTERVAL * 5);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('stops on a 400 — the session is no longer live', async () => {
      const { controller, send, onSessionGone } = makeController();
      send.mockRejectedValue(new ApiError(400, 'Session is not live'));

      controller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(onSessionGone).toHaveBeenCalled();
      expect(send).toHaveBeenCalledTimes(1);
    });
  });

  describe('beatNow', () => {
    it('beats out of band, for the return-to-foreground case', async () => {
      const { controller, send } = makeController();

      controller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(send).toHaveBeenCalledTimes(1);

      await controller.beatNow();
      expect(send).toHaveBeenCalledTimes(2);
      controller.stop();
    });

    it('does nothing when the controller is not running', async () => {
      const { controller, send } = makeController();

      await controller.beatNow();

      expect(send).not.toHaveBeenCalled();
    });

    it('does not stack a second in-flight request', async () => {
      let resolve!: (v: HeartbeatSnapshot) => void;
      const { controller, send } = makeController();
      send.mockImplementation(() => new Promise<HeartbeatSnapshot>((r) => (resolve = r)));

      controller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(send).toHaveBeenCalledTimes(1);

      await controller.beatNow();
      expect(send).toHaveBeenCalledTimes(1);

      resolve(snapshot());
      controller.stop();
    });
  });

  it('ignores a second start() so two screens cannot double the beat rate', async () => {
    const { controller, send } = makeController();

    controller.start();
    controller.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(send).toHaveBeenCalledTimes(1);
    controller.stop();
  });
});

describe('modo avião — o silêncio que o plano justifica', () => {
  /*
   O caso do dono do produto, 10/08: telefone em modo avião durante um pomodoro.

   Antes, cinco minutos de falha e o cliente declarava a sessão perdida. O
   servidor faz o mesmo cálculo do outro lado (`silencioToleradoAte`), e as duas
   pontas precisam concordar — se o cliente desiste antes, a pessoa vê
   "desconectado" numa sessão que continua de pé, perde o progresso na tela e
   (até 10/08) ficava com os apps bloqueados.
  */
  const falhaDeRede = () => Promise.reject(new Error('offline'));

  it('não declara a sessão perdida enquanto o plano a justifica', async () => {
    const perdida = vi.fn();
    const hb = new HeartbeatController({
      sessionId: 's1',
      send: falhaDeRede,
      onGraceExpired: perdida,
      graceMs: 1,                                   // janela curta já estourada
      intervalMs: 10_000,
      toleraSilencioAte: Date.now() + 60 * 60_000,  // mas o plano ainda cobre
    });
    hb.start();
    await vi.waitFor(() => expect(perdida).not.toHaveBeenCalled());
    expect(hb.isRunning).toBe(true);
    hb.stop();
  });

  it('desiste quando o plano acaba', async () => {
    const perdida = vi.fn();
    const hb = new HeartbeatController({
      sessionId: 's1',
      send: falhaDeRede,
      onGraceExpired: perdida,
      graceMs: 1,
      intervalMs: 10_000,
      toleraSilencioAte: Date.now() - 1_000,        // plano já vencido
    });
    hb.start();
    await vi.waitFor(() => expect(perdida).toHaveBeenCalledTimes(1));
    hb.stop();
  });
});
