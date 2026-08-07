/**
 * Como o tempo de estudo é escrito na tela, num lugar só.
 *
 * A regra é a do produto: **minuto até fechar a hora, hora depois disso.** Uma
 * tarde de 45 minutos se lê "45m", e não "0h 45m"; 1017 minutos se leem
 * "16h 57m", e não "1.0K".
 *
 * Existe em `lib/` porque os dois lugares que mostram esse número — o card do
 * perfil e o rodapé do calendário de sequência — chegaram a formatá-lo cada um
 * do seu jeito, e os dois estavam errados de maneiras diferentes.
 */

/**
 * `totalDurationMinutes` vem do Prisma como Decimal e chega aqui em ponto
 * flutuante: somar os dias de agosto dava `1017.1200000000001`, e o `% 60` do
 * rodapé imprimia `57.1200000000000005m` na tela do usuário.
 *
 * O arredondamento é feito **no total**, e não em cada parcela: arredondar
 * antes de dividir é o que faz "59,6 minutos" virar "0h 60m" em vez de "1h".
 */
export function formatarTempoDeEstudo(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return '0m';

  const total = Math.round(minutos);
  const horas = Math.floor(total / 60);
  const resto = total % 60;

  if (horas === 0) return `${resto}m`;
  // "16h 0m" é ruído: a hora cheia já é a informação inteira.
  if (resto === 0) return `${horas}h`;
  return `${horas}h ${resto}m`;
}
