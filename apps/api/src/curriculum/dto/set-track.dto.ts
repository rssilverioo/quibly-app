import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class SetTrackDto {
  @IsUUID()
  track_id: string;

  /** IANA, ex: 'America/Sao_Paulo'. O cliente sabe; o servidor não. */
  @IsString()
  @IsOptional()
  timezone?: string;

  /** Data da prova alvo. É o "dias até a prova" que a Fase 6 vai consumir. */
  @IsDateString()
  @IsOptional()
  exam_date?: string;
}
