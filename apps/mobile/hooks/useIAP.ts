import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  getOfferings,
  purchase as purchasePackage,
  restorePurchases,
  type PurchasesPackage,
} from '../services/iap';

export function useIAP() {
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [yearlyPackage, setYearlyPackage] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const offerings = await getOfferings();
        if (!mounted) return;

        const current = offerings?.current;
        if (current) {
          setMonthlyPackage(current.monthly ?? null);
          setYearlyPackage(current.annual ?? null);
        } else {
          console.warn('[useIAP] No current offering found');
        }
      } catch (err) {
        // getOfferings() (services/iap.ts) already catches RevenueCat errors
        // and reports them; this only guards against a bug in this effect
        // itself.
        console.warn('[useIAP] load offerings error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    setPurchasing(true);
    try {
      const customerInfo = await purchasePackage(pkg);
      return customerInfo;
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restore = useCallback(async () => {
    setPurchasing(true);
    try {
      return await restorePurchases();
    } finally {
      setPurchasing(false);
    }
  }, []);

  const getPrice = useCallback(
    (type: 'monthly' | 'yearly'): string | null => {
      const pkg = type === 'monthly' ? monthlyPackage : yearlyPackage;
      return pkg?.product.priceString ?? null;
    },
    [monthlyPackage, yearlyPackage],
  );

  const getManageSubscriptionUrl = useCallback((): string => {
    if (Platform.OS === 'ios') {
      return 'https://apps.apple.com/account/subscriptions';
    }
    return 'https://play.google.com/store/account/subscriptions';
  }, []);

  return {
    monthlyPackage,
    yearlyPackage,
    loading,
    purchasing,
    purchase,
    restore,
    getPrice,
    getManageSubscriptionUrl,
  };
}
