import { IsString, IsEnum, IsOptional } from 'class-validator';

export class GenerateFromTopicDto {
  @IsString()
  topic: string;

  @IsEnum(['flashcards', 'quiz'])
  type: 'flashcards' | 'quiz';

  @IsString()
  @IsOptional()
  language?: string;
}
