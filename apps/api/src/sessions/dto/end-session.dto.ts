import { IsNumber, IsUUID, Min } from 'class-validator';

export class EndSessionDto {
  @IsUUID()
  session_id: string;

  @IsNumber()
  @Min(0)
  pomodoro_cycles_completed: number;

  @IsNumber()
  @Min(0)
  total_duration_minutes: number;
}
