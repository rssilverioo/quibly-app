import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoomPostDto {
  @IsString()
  @IsOptional()
  @MaxLength(280)
  caption?: string;
}
