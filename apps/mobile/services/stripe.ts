import { api } from '../lib/api';

type PriceOption = 'brl_monthly' | 'brl_yearly' | 'usd_monthly' | 'usd_yearly';

export async function createCheckout(
  price: PriceOption,
): Promise<{ client_secret: string }> {
  return api.post<{ client_secret: string }>('/stripe/checkout', { price });
}

export async function cancelSubscription(): Promise<{ canceled: boolean }> {
  return api.post<{ canceled: boolean }>('/stripe/cancel');
}
