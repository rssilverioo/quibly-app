import { IsEnum } from 'class-validator';

export class AwardXpDto {
  @IsEnum(['flashcard_review', 'quiz_correct', 'quiz_wrong'])
  action: 'flashcard_review' | 'quiz_correct' | 'quiz_wrong';
}
