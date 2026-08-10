import {
  completedCycles,
  creditedDuration,
  endedEarly,
  measuredSeconds,
  pausedMillisWithin,
  sweepCreditInstant,
  silencioToleradoAte,
} from './session-timing';

const T0 = new Date('2026-07-29T10:00:00.000Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

describe('pausedMillisWithin', () => {
  it('is zero when there are no pauses', () => {
    expect(pausedMillisWithin([], T0, at(60))).toBe(0);
  });

  it('sums closed intervals', () => {
    const paused = pausedMillisWithin(
      [
        { startedAt: at(10), endedAt: at(20) },
        { startedAt: at(30), endedAt: at(35) },
      ],
      T0,
      at(60),
    );
    expect(paused).toBe(15 * 60_000);
  });

  it('treats an open interval as running to the end of the window', () => {
    const paused = pausedMillisWithin([{ startedAt: at(40), endedAt: null }], T0, at(60));
    expect(paused).toBe(20 * 60_000);
  });

  it('clips an interval that started before the window', () => {
    const paused = pausedMillisWithin(
      [{ startedAt: at(-30), endedAt: at(10) }],
      T0,
      at(60),
    );
    expect(paused).toBe(10 * 60_000);
  });

  it('clips an interval that runs past the window — the sweep case', () => {
    // Swept at the last heartbeat (minute 30) while a pause opened at minute 20
    // was still open. Only the 10 minutes inside the window count.
    const paused = pausedMillisWithin([{ startedAt: at(20), endedAt: null }], T0, at(30));
    expect(paused).toBe(10 * 60_000);
  });

  it('never exceeds the window, even if pause rows overlap', () => {
    const paused = pausedMillisWithin(
      [
        { startedAt: at(0), endedAt: at(60) },
        { startedAt: at(0), endedAt: at(60) },
      ],
      T0,
      at(60),
    );
    expect(paused).toBe(60 * 60_000);
  });

  it('is zero for an inverted window', () => {
    expect(pausedMillisWithin([{ startedAt: at(10), endedAt: at(20) }], at(60), T0)).toBe(0);
  });
});

describe('measuredSeconds', () => {
  it('is the wall clock minus pauses', () => {
    expect(
      measuredSeconds(T0, at(60), [{ startedAt: at(10), endedAt: at(25) }]),
    ).toBe(45 * 60);
  });

  it('is zero when the end is not after the start', () => {
    expect(measuredSeconds(at(60), T0, [])).toBe(0);
    expect(measuredSeconds(T0, T0, [])).toBe(0);
  });

  it('never goes negative when a pause covers the whole session', () => {
    expect(measuredSeconds(T0, at(30), [{ startedAt: T0, endedAt: at(30) }])).toBe(0);
  });
});

describe('creditedDuration', () => {
  it('credits everything when the cap is infinite', () => {
    const result = creditedDuration(90 * 60, 0, Infinity);
    expect(result.creditedMinutes).toBe(90);
    expect(result.clippedByDailyCap).toBe(false);
  });

  it('credits everything when the day has room', () => {
    const result = creditedDuration(30 * 60, 100, 960);
    expect(result.creditedMinutes).toBe(30);
    expect(result.clippedByDailyCap).toBe(false);
  });

  it('clips at the remaining allowance', () => {
    const result = creditedDuration(60 * 60, 930, 960);
    expect(result.creditedMinutes).toBe(30);
    expect(result.clippedByDailyCap).toBe(true);
  });

  it('credits nothing once the day is spent', () => {
    const result = creditedDuration(60 * 60, 960, 960);
    expect(result.creditedMinutes).toBe(0);
    expect(result.clippedByDailyCap).toBe(true);
  });

  it('does not call a session that fits exactly "clipped"', () => {
    const result = creditedDuration(30 * 60, 930, 960);
    expect(result.creditedMinutes).toBe(30);
    expect(result.clippedByDailyCap).toBe(false);
  });

  it('keeps the measurement even when the credit is cut', () => {
    const result = creditedDuration(120 * 60, 950, 960);
    expect(result.measuredSeconds).toBe(120 * 60);
    expect(result.creditedMinutes).toBe(10);
  });

  it('rounds to two decimals rather than truncating a partial minute away', () => {
    expect(creditedDuration(95, 0, Infinity).creditedMinutes).toBe(1.58);
  });
});

describe('completedCycles', () => {
  it('derives whole cycles from the credited duration', () => {
    expect(completedCycles('pomodoro', 45, 25)).toBe(1);
    expect(completedCycles('pomodoro', 50, 25)).toBe(2);
    expect(completedCycles('pomodoro', 24, 25)).toBe(0);
  });

  it('is always zero for modes with no target duration', () => {
    expect(completedCycles('stopwatch', 600, 25)).toBe(0);
    expect(completedCycles('audio', 600, 25)).toBe(0);
  });

  it('does not divide by zero when workDuration is missing', () => {
    expect(completedCycles('custom', 45, 0)).toBe(0);
  });
});

describe('endedEarly', () => {
  it('is true only when the user did not finish one full work block', () => {
    expect(endedEarly('pomodoro', 10, 25)).toBe(true);
    expect(endedEarly('pomodoro', 25, 25)).toBe(false);
    expect(endedEarly('pomodoro', 45, 25)).toBe(false);
  });

  it('is never true for a mode with no target duration', () => {
    expect(endedEarly('stopwatch', 1, 25)).toBe(false);
    expect(endedEarly('audio', 1, 25)).toBe(false);
  });
});

describe('sweepCreditInstant', () => {
  it('credits up to the last heartbeat', () => {
    expect(sweepCreditInstant(T0, at(30))).toEqual(at(30));
  });

  it('credits nothing when the session never beat', () => {
    expect(sweepCreditInstant(T0, null)).toEqual(T0);
  });

  it('ignores a heartbeat older than the start — clock skew must not subtract time', () => {
    expect(sweepCreditInstant(T0, at(-10))).toEqual(T0);
  });
});

describe('silencioToleradoAte — o modo avião', () => {
  const INICIO = new Date('2026-08-10T10:00:00.000Z');
  const pomodoro = {
    timerMode: 'pomodoro',
    workDuration: 25,
    breakDuration: 5,
    startedAt: INICIO,
  };
  const minutos = (n: number) => new Date(INICIO.getTime() + n * 60_000);

  it('um pomodoro calado aos 10 minutos ainda não é varrido', () => {
    // O caso relatado: telefone em modo avião. O plano são 4x(25+5) = 120min,
    // então aos 10 nada justifica declarar a sessão morta.
    expect(silencioToleradoAte(pomodoro, minutos(5))).toEqual(minutos(125));
  });

  it('passado o plano, vira zumbi e vai embora', () => {
    // 120 de plano + 5 de folga. Depois disso, silêncio é abandono.
    const limite = silencioToleradoAte(pomodoro, minutos(5));
    expect(minutos(126) > limite).toBe(true);
  });

  it('nunca encurta a janela que já existia', () => {
    // Um batimento perto do fim do plano ainda garante os 5 minutos de sempre:
    // a regra é o maior dos dois, nunca o menor.
    expect(silencioToleradoAte(pomodoro, minutos(124))).toEqual(minutos(129));
  });

  it('o cronômetro livre fica na janela curta — ele não tem plano', () => {
    /*
     `stopwatch` é aberto por definição. Conceder-lhe a janela longa seria
     concedê-la a qualquer sessão, já que o modo é escolha de um toque — e aí a
     régua deixaria de ser o plano e passaria a ser nada.
    */
    const livre = { ...pomodoro, timerMode: 'stopwatch' };
    expect(silencioToleradoAte(livre, minutos(5))).toEqual(minutos(10));
  });

  it('sem nenhum batimento, conta do início', () => {
    expect(silencioToleradoAte(pomodoro, null)).toEqual(minutos(125));
  });

  it('o plano não pode ser esticado depois: ele vem da linha, não do pedido', () => {
    // Blocos maiores dão janela maior, e é correto — mas `workDuration` é
    // escolhido na tela de preparo, antes de qualquer offline. Quem já está
    // desconectado não tem como mexer nele.
    const longo = { ...pomodoro, workDuration: 50, breakDuration: 10 };
    expect(silencioToleradoAte(longo, minutos(5))).toEqual(minutos(245));
  });
});
