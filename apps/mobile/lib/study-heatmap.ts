/**
 * A grade do mapa de constância — as "barrinhas verdes do GitHub", em azul.
 *
 * Só aritmética de calendário e classificação de intensidade. Fica em `lib/`
 * porque é a parte que erra em silêncio: um dia a mais no começo desloca a
 * semana inteira, e ninguém percebe olhando quadradinhos.
 */

export interface DiaDoMapa {
  /** `YYYY-MM-DD`. */
  data: string;
  minutos: number;
  /** 0 = não estudou; 1..4 = intensidade. Ver `nivelDeEstudo`. */
  nivel: 0 | 1 | 2 | 3 | 4;
  /** Fora da janela pedida — existe só para completar a primeira semana. */
  preenchimento: boolean;
}

/**
 * A intensidade de um dia, em degraus que **significam algo no produto**.
 *
 * Os cortes são múltiplos do pomodoro de 25 minutos, não quartis: quartil faz o
 * mapa mudar de cor quando os *outros* dias mudam, então a mesma tarde de
 * estudo pinta diferente conforme o mês. Aqui um dia de 50 minutos é sempre o
 * mesmo tom, e "mais escuro" quer dizer "estudei mais", não "estudei mais que
 * de costume".
 */
export function nivelDeEstudo(minutos: number): 0 | 1 | 2 | 3 | 4 {
  if (minutos <= 0) return 0;
  if (minutos < 25) return 1; // menos de um pomodoro
  if (minutos < 50) return 2; // um pomodoro
  if (minutos < 100) return 3; // dois ou três
  return 4; // quatro ou mais
}

/** Meia-noite local de uma data `YYYY-MM-DD`, sem passar por fuso. */
function doTexto(data: string): Date {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

const paraTexto = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Monta as colunas do mapa: uma por semana, sete linhas por coluna.
 *
 * A primeira coluna recua até o **domingo anterior** ao início da janela, e os
 * dias que sobram vêm marcados como `preenchimento`. Sem esse recuo as linhas
 * deixam de ser dias da semana — a grade continua bonita e passa a mentir, que
 * é pior que estar visivelmente errada.
 *
 * `porDia` traz só os dias com estudo (é o que o servidor manda); todo o resto
 * nasce zero.
 */
export function montarSemanas(
  de: string,
  ate: string,
  porDia: Record<string, number>,
): DiaDoMapa[][] {
  const inicio = doTexto(de);
  const fim = doTexto(ate);
  if (fim < inicio) return [];

  // Recua para o domingo da semana do primeiro dia.
  const cursor = new Date(inicio);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  const semanas: DiaDoMapa[][] = [];
  let semana: DiaDoMapa[] = [];

  while (cursor <= fim) {
    const data = paraTexto(cursor);
    const minutos = porDia[data] ?? 0;
    semana.push({
      data,
      minutos,
      nivel: nivelDeEstudo(minutos),
      preenchimento: cursor < inicio,
    });

    if (semana.length === 7) {
      semanas.push(semana);
      semana = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // A última semana quase nunca fecha em sábado: hoje é o fim da janela.
  if (semana.length > 0) semanas.push(semana);
  return semanas;
}

/** Quantos dias da janela tiveram estudo. É o número que a legenda resume. */
export const diasComEstudo = (semanas: DiaDoMapa[][]): number =>
  semanas.flat().filter((d) => !d.preenchimento && d.nivel > 0).length;
