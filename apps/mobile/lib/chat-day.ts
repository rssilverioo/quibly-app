import type { ChatMessageComAutor } from './chat-messages';

/**
 * Os separadores de dia da conversa — "Hoje", "Ontem", "12 de maio".
 *
 * Fica em `lib/` porque é aritmética de calendário, que é a família de erro que
 * não aparece olhando a tela: uma comparação por diferença de horas em vez de
 * por data civil produz "Ontem" às 23h59 e "Hoje" um minuto depois, e a
 * conversa continua parecendo certa.
 */

/** A data civil local de um ISO, como `YYYY-MM-DD`. */
export function diaCivil(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Se esta mensagem abre um dia novo na conversa.
 *
 * `anterior` é a mensagem imediatamente mais **velha**. Numa `FlatList inverted`
 * ela é a de índice seguinte, não a de índice anterior — e trocar os dois
 * desenha o separador no fim de cada dia em vez de no começo, o que é
 * simétrico o bastante para passar despercebido.
 */
export function abreDia(
  mensagem: Pick<ChatMessageComAutor, 'created_at'>,
  anterior?: Pick<ChatMessageComAutor, 'created_at'>,
): boolean {
  if (!anterior) return true;
  return diaCivil(mensagem.created_at) !== diaCivil(anterior.created_at);
}

/**
 * Quantos dias civis separam duas datas — 0 é o mesmo dia, 1 é ontem.
 *
 * Comparado à meia-noite dos dois lados de propósito. Dividir a diferença em
 * milissegundos por 24h erraria em toda mudança de horário de verão, e erraria
 * também para duas datas a 20 horas de distância que caem em dias diferentes.
 */
function diasAtras(iso: string, agora: Date): number {
  const d = new Date(iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export interface RotulosDeDia {
  hoje: string;
  ontem: string;
  /** Formatador para qualquer data mais velha que ontem. */
  formatarData: (iso: string) => string;
}

/**
 * O rótulo do separador.
 *
 * "Hoje" e "Ontem" vêm do i18n, e a data mais velha é formatada por quem chama —
 * o formato de data é do idioma, não desta função.
 */
export function rotuloDoDia(iso: string, rotulos: RotulosDeDia, agora = new Date()): string {
  const dias = diasAtras(iso, agora);
  if (dias <= 0) return rotulos.hoje;
  if (dias === 1) return rotulos.ontem;
  return rotulos.formatarData(iso);
}
