import { IsString, IsOptional } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  platform?: string;
}
