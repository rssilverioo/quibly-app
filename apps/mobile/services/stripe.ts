import { api } from '../lib/api';

type PriceOption = 'brl_monthly' | 'brl_yearly' | 'usd_monthly' | 'usd_yearly';

export interface MobileCheckoutResponse {
  paymentIntent: string;
  ephemeralKey: string;
  customer: string;
  subscriptionId: string;
}

export async function createMobileCheckout(
  price: PriceOption,
): Promise<MobileCheckoutResponse> {
  return api.post<MobileCheckoutResponse>('/stripe/mobile-checkout', { price });
}

export async function cancelSubscription(): Promise<{ canceled: boolean }> {
  return api.post<{ canceled: boolean }>('/stripe/cancel');
}
