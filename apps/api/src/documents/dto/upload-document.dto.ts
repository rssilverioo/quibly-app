import { IsString, IsOptional } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  subject?: string;
}
