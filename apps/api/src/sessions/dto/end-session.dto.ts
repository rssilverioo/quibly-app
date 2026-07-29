import { ArrayMaxSize, IsArray, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

/**
 * Body of `POST /sessions/:id/end` — intentionally empty.
 *
 * The session comes from the URL and everything else from the server: the end
 * instant is `now`, the duration is measured from `startedAt` minus recorded
 * pauses, and the pomodoro cycle count is derived from that duration. Nothing
 * the client could say about time is believed.
 */
export class EndSessionDto {
  /**
   * O que o usuário marcou ter estudado. Opcional: ninguém preenche formulário
   * depois de três horas de estudo, e forçar isso faria as pessoas pararem de
   * encerrar sessões — o que custaria muito mais do que a tag vale.
   *
   * O teto de 20 é sanidade, não regra de produto: uma sessão que tocou vinte
   * tópicos não está dizendo nada útil sobre nenhum deles.
   */
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  topic_ids?: string[];
}

/**
 * Body of the deprecated `POST /sessions/end`.
 *
 * v1.2.1 is live in the store and posts `session_id`,
 * `total_duration_minutes` and `pomodoro_cycles_completed` to that route. The
 * global ValidationPipe runs with `forbidNonWhitelisted: true`, so those fields
 * have to stay *declared* — otherwise every old client takes a 400 the moment
 * this deploys, which is a hard break for anyone who hasn't updated.
 *
 * So they are declared and then ignored: the service measures the duration
 * server-side either way. An old client keeps working and silently starts
 * getting honest numbers. Delete this class once the store minimum is past the
 * release that moves to `POST /sessions/:id/end`.
 */
export class LegacyEndSessionDto {
  @IsUUID()
  session_id: string;

  /** Ignored. The server measures the duration. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  total_duration_minutes?: number;

  /** Ignored. The server derives cycles from the measured duration. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  pomodoro_cycles_completed?: number;
}
