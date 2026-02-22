import { IsString, Length, MinLength, MaxLength } from 'class-validator';

export class JoinLeagueDto {
  @IsString()
  @Length(8, 8)
  invite_code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(30)
  display_name: string;
}
