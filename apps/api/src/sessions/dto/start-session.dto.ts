import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * Note what is *not* here: no duration, no cycle count.
 *
 * O início **deixou de estar** nessa lista em 10/08, e a exceção é estreita.
 * Uma sessão que nasce em modo avião roda no aparelho antes de o servidor saber
 * dela, então ela chega com um início declarado — e o servidor o **corta** ao
 * que o plano justifica (`inicioAceitavel`). Fora esse caso, quem carimba
 * continua sendo o servidor. Ver docs/API-SESSIONS.md §1.
 */
export class StartSessionDto {
  @IsUUID()
  subject_id: string;

  @IsUUID()
  @IsOptional()
  league_id?: string;

  @IsEnum(['pomodoro', 'deep_focus', 'custom', 'audio', 'stopwatch'], {
    message:
      'timer_mode must be one of: pomodoro, deep_focus, custom, audio, stopwatch',
  })
  timer_mode: 'pomodoro' | 'deep_focus' | 'custom' | 'audio' | 'stopwatch';

  /**
   * Ignored for `stopwatch` (no target duration) — the column keeps its schema
   * default so nothing downstream has to special-case a null.
   */
  @IsNumber()
  @Min(5)
  @Max(120)
  @IsOptional()
  work_duration?: number;

  @IsNumber()
  @Min(1)
  @Max(30)
  @IsOptional()
  break_duration?: number;

  @IsBoolean()
  proof_mode: boolean;

  /**
   * A identidade que o aparelho deu à sessão antes de o servidor conhecê-la.
   *
   * Torna o registro tardio idempotente: se a chamada se perder no caminho e o
   * app repetir, sem isto o mesmo estudo viraria duas sessões.
   */
  @IsUUID()
  @IsOptional()
  client_session_id?: string;

  /**
   * Quando o aparelho diz que a sessão começou. **Uma dica, não um fato.**
   *
   * Só chega de sessão nascida offline, e é cortada pelo servidor ao que o
   * plano dela justifica. Ausente — o caminho normal — o servidor carimba o
   * agora dele, como sempre fez.
   */
  @IsISO8601()
  @IsOptional()
  started_at_hint?: string;
}
