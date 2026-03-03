import { api } from '../lib/api';

type PriceOption = 'brl_monthly' | 'brl_yearly' | 'usd_monthly' | 'usd_yearly';

export interface MobileCheckoutResponse {
  setupIntent?: string;
  paymentIntent?: string;
  ephemeralKey: string;
  customer: string;
}

export async function createMobileCheckout(
  price: PriceOption,
): Promise<MobileCheckoutResponse> {
  return api.post<MobileCheckoutResponse>('/stripe/mobile-checkout', { price });
}

export async function activateSubscription(
  price: PriceOption,
): Promise<{ subscriptionId: string; status: string }> {
  return api.post('/stripe/activate', { price });
}

export async function cancelSubscription(): Promise<{ canceled: boolean }> {
  return api.post<{ canceled: boolean }>('/stripe/cancel');
}
