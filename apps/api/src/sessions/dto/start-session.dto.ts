import { IsBoolean, IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Note what is *not* here: no duration, no cycle count, no start timestamp.
 * The server stamps `startedAt` itself — see docs/API-SESSIONS.md §1.
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
}
