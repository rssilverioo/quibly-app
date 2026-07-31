import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateChallengeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title: string;

  @IsIn(['minutes'])
  metric: 'minutes';

  @IsDateString()
  @IsOptional()
  starts_on?: string;

  @IsDateString()
  ends_on: string;
}
