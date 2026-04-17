import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateAudioSessionDto {
  @IsUUID()
  flashcard_set_id: string;

  @IsInt()
  @Min(5)
  @Max(60)
  duration_minutes: number;

  @IsString()
  @IsOptional()
  voice?: string;
}
