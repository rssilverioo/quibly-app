/**
 * A unidade da métrica do desafio, como texto para a tela.
 *
 * O servidor manda um **token** (`'days'`, `'min'`), não a palavra pronta. Antes
 * mandava `'min'` e a tela imprimia direto — passou despercebido porque "min" é
 * igual em português e inglês. Com dias isso quebraria na hora: um app em
 * português mostrando "days".
 *
 * Token desconhecido volta como veio, em vez de sumir: uma métrica nova no
 * servidor aparece feia por um deploy, e não invisível.
 */
export function unidadeDaMetrica(
  token: string | undefined,
  valor: number,
  t: (chave: string, opcoes?: Record<string, unknown>) => string,
): string {
  if (!token) return '';
  if (token === 'days') return t('rooms.daysUnit', { count: valor });
  if (token === 'min') return t('rooms.minutesUnit', { count: valor });
  return token;
}
