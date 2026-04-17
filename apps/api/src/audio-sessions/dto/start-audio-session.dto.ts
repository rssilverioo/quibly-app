import { IsOptional, IsUUID } from 'class-validator';

export class StartAudioSessionDto {
  @IsUUID()
  subject_id: string;

  @IsUUID()
  @IsOptional()
  league_id?: string;
}
