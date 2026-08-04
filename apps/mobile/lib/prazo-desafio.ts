/**
 * O prazo do desafio, convertido entre data e dias.
 *
 * Quem cria a sala pensa em **data** — "vai até a prova, dia 12" —, mas o que o
 * `POST /rooms` recebe é `duration_days`. A conversão mora aqui, e não na tela,
 * porque a tela importa React Native e não pode ser carregada por teste.
 */

/** Teto do `CreateRoomDto`. Repetido aqui para a tela não oferecer o que a API recusa. */
export const PRAZO_MAXIMO_DIAS = 365;

/** Meia-noite local daqui a `n` dias. */
export function emDias(n: number): Date {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() + n);
  return data;
}

/**
 * Dias inteiros de hoje até a data escolhida.
 *
 * Os dois lados são normalizados para meia-noite **antes** de subtrair, e o
 * resultado é arredondado. Sem isso, duas coisas vazariam na conta: a hora em
 * que a pessoa criou a sala, e o horário de verão no meio do caminho — que tira
 * ou dá uma hora e, num truncamento, vira um dia inteiro a menos.
 *
 * O piso é 1: desafio que termina hoje nasce encerrado.
 */
export function diasAte(data: Date, agora = new Date()): number {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(data);
  alvo.setHours(0, 0, 0, 0);
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
  return Math.min(PRAZO_MAXIMO_DIAS, Math.max(1, dias));
}
