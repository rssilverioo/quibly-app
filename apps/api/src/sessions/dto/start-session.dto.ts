import { IsBoolean, IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class StartSessionDto {
  @IsUUID()
  subject_id: string;

  @IsUUID()
  @IsOptional()
  league_id?: string;

  @IsEnum(['pomodoro', 'deep_focus', 'custom'], {
    message: 'timer_mode must be one of: pomodoro, deep_focus, custom',
  })
  timer_mode: 'pomodoro' | 'deep_focus' | 'custom';

  @IsNumber()
  @Min(5)
  @Max(120)
  work_duration: number;

  @IsNumber()
  @Min(1)
  @Max(30)
  break_duration: number;

  @IsBoolean()
  proof_mode: boolean;
}
