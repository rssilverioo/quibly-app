import { IsString, MinLength, MaxLength } from 'class-validator';

export class AskLessonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question: string;
}
