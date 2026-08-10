import { useState, useEffect, useCallback, useMemo } from 'react';
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

          /*
           O que o SDK realmente entregou.

           Em 09/08 a tela mostrou `$99.99/year` enquanto a folha de compra da
           Apple, para a mesma conta e o mesmo pacote, dizia `R$ 129,90 per
           year`. Como a tela usa `priceString` — o texto que o próprio StoreKit
           formata —, os dois só divergem se o produto que o SDK tem em mãos não
           for o que a Apple vai cobrar. O suspeito é o cache de ofertas do
           RevenueCat, que segura produtos por até 24h e ficou defasado quando
           mudamos os preços naquele dia.

           Sem este registro, a próxima investigação recomeça do zero: o
           `priceString` sozinho não diz em que moeda o SDK acha que está, nem
           qual produto ele casou. `currencyCode` responde as duas coisas.
          */
          console.log('[IAP] produtos carregados', {
            mensal: {
              id: current.monthly?.product.identifier,
              preco: current.monthly?.product.price,
              texto: current.monthly?.product.priceString,
              moeda: current.monthly?.product.currencyCode,
            },
            anual: {
              id: current.annual?.product.identifier,
              preco: current.annual?.product.price,
              texto: current.annual?.product.priceString,
              moeda: current.annual?.product.currencyCode,
            },
          });
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

  /**
   * Quanto o anual economiza, calculado dos preços de verdade.
   *
   * A tela mostrava `17%` escrito no código, e isso não sobrevive a nenhuma
   * mudança de preço.
   *
   * Os preços de 09/08 são US$ 9,99 e R$ 19,99 no mês, com o anual mirando
   * **48%** de desconto: US$ 61,99 e R$ 124,99. Só que a Apple converte esses
   * valores para as outras dezenas de moedas com câmbio próprio, e o desconto
   * resultante muda em cada uma. Nenhum número escrito aqui poderia estar
   * certo em todas — e um número errado numa oferta de assinatura não é
   * detalhe, é promessa quebrada no lugar onde a pessoa decide pagar.
   *
   * Calculado dos preços que a loja devolve, o texto não tem como mentir —
   * mexer no preço no App Store Connect atualiza a promessa sozinho.
   *
   * `null` quando falta um dos dois: sem os dois preços não há desconto a
   * afirmar, e a etiqueta some em vez de exibir um número inventado.
   */
  const economiaAnual = useMemo(() => {
    const mes = monthlyPackage?.product.price;
    const ano = yearlyPackage?.product.price;
    if (!mes || !ano) return null;
    const percentual = Math.round((1 - ano / (mes * 12)) * 100);
    // Um "economize 0%" ou um desconto negativo é pior que etiqueta nenhuma.
    return percentual > 0 ? percentual : null;
  }, [monthlyPackage, yearlyPackage]);

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
    economiaAnual,
    getManageSubscriptionUrl,
  };
}
