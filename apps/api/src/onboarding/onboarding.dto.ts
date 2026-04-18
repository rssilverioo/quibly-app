import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CompleteOnboardingDto {
  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsEnum(['high_school', 'college', 'graduate', 'professional', 'other'])
  education_level: string;

  @IsString()
  @IsEnum(['exam_prep', 'school', 'certification', 'fun', 'other'])
  study_goal: string;

  @IsInt()
  @Min(5)
  @Max(120)
  daily_goal_minutes: number;

  @IsArray()
  @IsString({ each: true })
  subjects: string[];
}
