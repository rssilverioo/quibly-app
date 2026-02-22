import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4)
  emoji: string;
}
