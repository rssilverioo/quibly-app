import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateLeagueDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsEnum(['public', 'private'])
  privacy: 'public' | 'private';

  @IsEnum(['easy', 'competitive', 'hardcore'])
  mode: 'easy' | 'competitive' | 'hardcore';

  @IsNumber()
  @IsOptional()
  @Min(2)
  @Max(100)
  max_members?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(30)
  display_name: string;
}
