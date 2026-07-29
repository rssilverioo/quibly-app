import Purchases, {
  type PurchasesOfferings,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';
import { captureException } from '../lib/sentry';

const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';
const ENTITLEMENT_ID = 'pro';

export type { PurchasesPackage, PurchasesOfferings };

export async function initRevenueCat(userId: string): Promise<void> {
  Purchases.configure({
    apiKey: __DEV__
      ? REVENUECAT_API_KEY_IOS // dev builds are iOS-first
      : require('react-native').Platform.OS === 'ios'
        ? REVENUECAT_API_KEY_IOS
        : REVENUECAT_API_KEY_ANDROID,
    appUserID: userId,
  });
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (err) {
    console.warn('[RevenueCat] getOfferings error:', err);
    captureException(err, { where: 'RevenueCat.getOfferings' });
    return null;
  }
}

export async function purchase(
  pkg: PurchasesPackage,
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<{
  restored: boolean;
}> {
  const customerInfo = await Purchases.restorePurchases();
  const isActive = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  return { restored: isActive };
}

export function checkEntitlement(customerInfo: CustomerInfo): boolean {
  return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}
