import type { StudyHeatmap } from '../services/sessions';

/**
 * O dia de hoje contra a meta, e a semana que levou até ele.
 *
 * Fica em `lib/` pelo mesmo motivo do `study-heatmap`: é aritmética de
 * calendário, e calendário erra em silêncio. Um dia deslocado aqui não quebra
 * nada — só faz a tela dizer que você não estudou hoje quando estudou.
 */

export interface DiaDaSemana {
  /** `YYYY-MM-DD`. */
  data: string;
  minutos: number;
  /** Se este é o dia corrente. */
  hoje: boolean;
  /** Índice do dia na semana, 0 = domingo. Para rotular sem recalcular. */
  diaDaSemana: number;
}

export interface ResumoDoDia {
  minutosHoje: number;
  metaMinutos: number;
  /** 0..1, já saturado em 1. */
  progresso: number;
  /** Quanto falta para bater a meta. Zero quando já bateu. */
  faltamMinutos: number;
  cumpriu: boolean;
  /** Os sete dias terminando hoje, do mais antigo para o mais recente. */
  semana: DiaDaSemana[];
  /** Dias com estudo na janela recebida. É o número honesto de "dias estudados". */
  diasEstudados: number;
}

const paraTexto = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Monta o resumo a partir da resposta do mapa de constância.
 *
 * ## Por que reaproveita esse endpoint
 *
 * `GET /sessions/study-heatmap` já devolve minutos por dia numa janela que
 * **termina hoje**. Pedir sete dias dá exatamente a semana, sem rota nova e sem
 * um segundo caminho que possa discordar do mapa do perfil.
 *
 * A resposta traz **só os dias com estudo** — os zeros são omitidos. Por isso a
 * semana é construída a partir do calendário e o mapa serve de consulta: montar
 * a partir da lista faria a semana encolher nos dias parados, que é justamente
 * a informação que interessa mostrar.
 *
 * ## Por que a meta tem piso
 *
 * `daily_goal_minutes` vem do onboarding e tem padrão 15. Conta antiga, ou
 * resposta perdida, pode chegar com 0 — e meta zero faria a barra nascer cheia
 * e dizer "dia cumprido" para quem não estudou nada. Quinze é o mesmo padrão do
 * banco, então o piso não inventa número: repete o que já é a regra.
 */
export function resumirODia(
  mapa: StudyHeatmap | null,
  metaBruta: number | undefined,
  agora: Date = new Date(),
): ResumoDoDia {
  const metaMinutos = Math.max(15, metaBruta ?? 15);

  const porData = new Map((mapa?.days ?? []).map((d) => [d.date, d.minutes]));

  const semana: DiaDaSemana[] = [];
  for (let recuo = 6; recuo >= 0; recuo -= 1) {
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - recuo);
    const data = paraTexto(dia);
    semana.push({
      data,
      minutos: porData.get(data) ?? 0,
      hoje: recuo === 0,
      diaDaSemana: dia.getDay(),
    });
  }

  /**
   * Inteiro, sempre.
   *
   * O servidor devolve fração — a sessão é medida em segundos —, e a tela
   * mostrava "2.27 de 15 min" e "faltam 12.73 min". Ninguém conta o próprio
   * estudo com duas casas decimais, e a precisão que sobra só faz o número
   * parecer instrumento de laboratório.
   */
  const minutosHoje = Math.round(semana[semana.length - 1].minutos);
  const progresso = Math.min(1, minutosHoje / metaMinutos);

  return {
    minutosHoje,
    metaMinutos,
    progresso,
    faltamMinutos: Math.max(0, Math.round(metaMinutos - minutosHoje)),
    cumpriu: minutosHoje >= metaMinutos,
    semana,
    // Contado, não estimado. O número que estava na tela dividia os minutos
    // totais por 25 e chamava o resultado de "dias estudados" — 17h viravam
    // "41 dias", que é a contagem de blocos de pomodoro, não de dias.
    diasEstudados: (mapa?.days ?? []).filter((d) => d.minutes > 0).length,
  };
}
