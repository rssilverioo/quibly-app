import { IsString, MinLength, Matches } from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @MinLength(2)
  username: string;

  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_]+$/)
  handle: string;
}
