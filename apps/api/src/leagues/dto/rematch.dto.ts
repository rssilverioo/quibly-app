import { IsDateString } from 'class-validator';

export class RematchDto {
  @IsDateString()
  end_date: string;
}
