import { IsUUID, IsOptional, IsString } from 'class-validator';

export class GenerateFromDocumentDto {
  @IsUUID()
  document_id: string;

  @IsString()
  @IsOptional()
  language?: string;
}
