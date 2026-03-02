import { IsEnum } from 'class-validator';

export class CreateCheckoutDto {
  @IsEnum(['brl_monthly', 'brl_yearly', 'usd_monthly', 'usd_yearly'])
  price: 'brl_monthly' | 'brl_yearly' | 'usd_monthly' | 'usd_yearly';
}
