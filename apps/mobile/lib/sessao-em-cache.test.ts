import { beforeEach, describe, expect, it, vi } from 'vitest';

const loja = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => loja.get(k) ?? null,
    setItem: async (k: string, v: string) => void loja.set(k, v),
    removeItem: async (k: string) => void loja.delete(k),
  },
}));

const { guardar, ler, limpar, registrarBatida, provaDesde } = await import(
  './sessao-em-cache'
);

const CHAVE = '@quibly/sessao-viva';
const base = {
  id: null,
  idLocal: 'local-1',
  subjectId: 'materia-1',
  leagueId: null,
  timerMode: 'pomodoro',
  workDuration: 25,
  breakDuration: 5,
  comecouEm: 1_000_000,
  batidas: [] as number[],
};

beforeEach(() => loja.clear());

describe('a sessão guardada no aparelho', () => {
  it('guarda e lê de volta', async () => {
    await guardar(base);
    expect(await ler()).toEqual(base);
  });

  it('vazio é null, não erro', async () => {
    expect(await ler()).toBeNull();
  });

  it('limpar apaga', async () => {
    await guardar(base);
    await limpar();
    expect(await ler()).toBeNull();
  });

  it('registra batidas em ordem', async () => {
    await guardar(base);
    await registrarBatida(10);
    const s = await registrarBatida(20);
    expect(s?.batidas).toEqual([10, 20]);
  });

  it('registrar sem sessão guardada não cria uma do nada', async () => {
    expect(await registrarBatida(10)).toBeNull();
    expect(await ler()).toBeNull();
  });

  describe('conteúdo estragado', () => {
    /*
     O que está no disco veio de uma versão anterior do app. Um campo que mudou
     de tipo não pode virar `NaN` no cronômetro — foi assim que a tela já
     imprimiu `NaN:NaN` uma vez, ao retomar sessão sem `work_duration`.
    */
    it('JSON inválido vira null', async () => {
      loja.set(CHAVE, '{ isto não é json');
      expect(await ler()).toBeNull();
    });

    it('forma desconhecida vira null e é apagada', async () => {
      loja.set(CHAVE, JSON.stringify({ idLocal: 'x' }));
      expect(await ler()).toBeNull();
      expect(loja.has(CHAVE)).toBe(false);
    });

    it('comecouEm não numérico é recusado em vez de virar NaN', async () => {
      loja.set(CHAVE, JSON.stringify({ ...base, comecouEm: 'ontem' }));
      expect(await ler()).toBeNull();
    });

    it('batidas não numéricas são descartadas, sem derrubar o resto', async () => {
      loja.set(
        CHAVE,
        JSON.stringify({ ...base, batidas: [10, 'vinte', null, 30] }),
      );
      expect((await ler())?.batidas).toEqual([10, 30]);
    });
  });

  describe('o teto do registro', () => {
    it('corta pelo começo, mantendo as batidas recentes', async () => {
      /*
       As recentes são as que provam o intervalo que o servidor não viu; as
       antigas ele já carimbou. Cortar pelo fim jogaria fora exatamente a prova.
      */
      await guardar({ ...base, batidas: Array.from({ length: 2000 }, (_, i) => i) });
      const s = await registrarBatida(9999);
      expect(s?.batidas).toHaveLength(2000);
      expect(s?.batidas[1999]).toBe(9999);
      expect(s?.batidas[0]).toBe(1);
    });
  });

  describe('provaDesde', () => {
    it('manda só o que o servidor ainda não viu', async () => {
      const s = { ...base, batidas: [10, 20, 30, 40] };
      expect(provaDesde(s, 20)).toEqual([30, 40]);
    });

    it('servidor em dia recebe prova vazia', async () => {
      const s = { ...base, batidas: [10, 20] };
      expect(provaDesde(s, 20)).toEqual([]);
    });
  });
});
