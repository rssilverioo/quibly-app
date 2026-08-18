import { describe, expect, it } from 'vitest';
import {
  diasDeTesteGratis,
  elegibilidadeDoStatus,
  podePrometerTeste,
} from './teste-gratis';

/**
 * As regras do teste grátis, que decidem o que a tela de assinatura promete.
 *
 * Cada caso aqui é um jeito de a tela mentir onde a pessoa decide pagar — e
 * mentira nesse ponto vira cobrança contestada, não bug.
 */
describe('dias de teste grátis', () => {
  it('lê a oferta introdutória do iOS', () => {
    expect(
      diasDeTesteGratis({
        introPrice: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7 },
      }),
    ).toBe(7);
  });

  it('converte semana em dias', () => {
    // A Apple grava "7 dias" como P1W. Sem a conversão a tela diria "1 grátis".
    expect(
      diasDeTesteGratis({
        introPrice: { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1 },
      }),
    ).toBe(7);
  });

  /**
   * O caso caro. A Apple e o Google usam o **mesmo campo** para oferta paga —
   * "primeiro mês pela metade" — e para teste grátis. Chamar meio preço de
   * grátis é cobrança inesperada no primeiro dia.
   */
  it('não chama oferta paga de teste grátis', () => {
    expect(
      diasDeTesteGratis({
        introPrice: { price: 9.9, periodUnit: 'MONTH', periodNumberOfUnits: 1 },
      }),
    ).toBeNull();
  });

  it('lê a fase gratuita do plano base no Android', () => {
    expect(
      diasDeTesteGratis({
        introPrice: null,
        defaultOption: { freePhase: { billingPeriod: { unit: 'WEEK', value: 1 } } },
      }),
    ).toBe(7);
  });

  it('cai para a fase gratuita quando a oferta introdutória é paga', () => {
    // Um produto pode ter as duas fases; a paga vindo primeiro não pode
    // apagar a gratuita que existe do lado do Android.
    expect(
      diasDeTesteGratis({
        introPrice: { price: 4.9, periodUnit: 'MONTH', periodNumberOfUnits: 1 },
        defaultOption: { freePhase: { billingPeriod: { unit: 'DAY', value: 3 } } },
      }),
    ).toBe(3);
  });

  it('devolve nulo quando não há oferta nenhuma', () => {
    expect(diasDeTesteGratis({ introPrice: null, defaultOption: null })).toBeNull();
    expect(diasDeTesteGratis({})).toBeNull();
    expect(diasDeTesteGratis(null)).toBeNull();
  });

  it('ignora período inválido em vez de inventar um número', () => {
    expect(
      diasDeTesteGratis({
        introPrice: { price: 0, periodUnit: 'UNKNOWN', periodNumberOfUnits: 1 },
      }),
    ).toBeNull();
    expect(
      diasDeTesteGratis({
        introPrice: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 0 },
      }),
    ).toBeNull();
  });
});

describe('elegibilidade', () => {
  it('traduz o enum do RevenueCat', () => {
    expect(elegibilidadeDoStatus(2)).toBe('elegivel');
    expect(elegibilidadeDoStatus(1)).toBe('inelegivel');
    expect(elegibilidadeDoStatus(0)).toBe('desconhecida');
    expect(elegibilidadeDoStatus(undefined)).toBe('desconhecida');
  });

  /**
   * `3` é NO_INTRO_OFFER_EXISTS — uma resposta, não uma dúvida. Tratar como
   * dúvida faria a tela prometer um teste que o catálogo não tem.
   */
  it('trata "não existe oferta" como resposta definitiva', () => {
    expect(elegibilidadeDoStatus(3)).toBe('inelegivel');
  });
});

describe('pode prometer o teste', () => {
  /**
   * O motivo de a regra existir: quem já usou os 7 dias e lê "7 dias grátis"
   * toca o botão e é cobrado na hora. No iOS a checagem responde de verdade,
   * então dúvida vale como não.
   */
  it('no iOS exige elegibilidade confirmada', () => {
    expect(podePrometerTeste({ dias: 7, elegibilidade: 'elegivel', plataforma: 'ios' })).toBe(true);
    expect(podePrometerTeste({ dias: 7, elegibilidade: 'desconhecida', plataforma: 'ios' })).toBe(false);
    expect(podePrometerTeste({ dias: 7, elegibilidade: 'inelegivel', plataforma: 'ios' })).toBe(false);
  });

  /**
   * No Android a API **sempre** devolve UNKNOWN. Aplicar a regra do iOS
   * esconderia o teste de todo mundo — e não precisa: o Play só devolve as
   * ofertas para as quais a conta é elegível, então a fase gratuita existir já
   * é a resposta.
   */
  it('no Android aceita desconhecida, que é a única resposta que existe lá', () => {
    expect(podePrometerTeste({ dias: 7, elegibilidade: 'desconhecida', plataforma: 'android' })).toBe(true);
  });

  it('no Android ainda respeita um "não" explícito', () => {
    expect(podePrometerTeste({ dias: 7, elegibilidade: 'inelegivel', plataforma: 'android' })).toBe(false);
  });

  it('sem dias não há o que prometer', () => {
    expect(podePrometerTeste({ dias: null, elegibilidade: 'elegivel', plataforma: 'ios' })).toBe(false);
    expect(podePrometerTeste({ dias: 0, elegibilidade: 'elegivel', plataforma: 'android' })).toBe(false);
  });
});
