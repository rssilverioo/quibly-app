import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MOTIVOS, TIPOS_DENUNCIAVEIS } from '../moderation.service';

export class CreateReportDto {
  @IsIn(TIPOS_DENUNCIAVEIS as unknown as string[])
  target_type!: string;

  @IsString()
  target_id!: string;

  @IsIn(MOTIVOS as unknown as string[])
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
