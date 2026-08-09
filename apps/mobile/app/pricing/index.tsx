import React, { useEffect, useState } from 'react';
import { COMPRAS_NO_APP_ATIVAS } from '../../services/iap';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@quibly/shared/constants';
import { legacyColors as COLORS } from '../../theme';
import { ArrowLeft, Check, Crown, RotateCcw } from 'lucide-react-native';
import { Mascot } from '../../components/mascot';
import { track } from '../../lib/analytics';
import { useUsage } from '../../hooks/useUsage';
import { useIAP } from '../../hooks/useIAP';
import i18n from '../../lib/i18n';
import { captureException } from '../../lib/sentry';
import { voltar } from '../../lib/navegacao';

type Billing = 'monthly' | 'yearly';

export default function PricingScreen() {
  const router = useRouter();
  const { t } = useTranslation('pricing');
  const { usage, refresh: refreshUsage } = useUsage();
  const { monthlyPackage, yearlyPackage, purchasing, purchase, restore, getPrice, economiaAnual, getManageSubscriptionUrl } = useIAP();
  const [billing, setBilling] = useState<Billing>('monthly');
  const [restoring, setRestoring] = useState(false);

  const isPro = usage?.plan === 'PRO';

  /**
   * Compra desligada: a tela não deve existir nem por deep link.
   *
   * A porta da interface (a linha "Meu plano" no perfil) já está escondida, mas
   * `quibly://pricing` continua resolvendo — e o que apareceria é justamente o
   * paywall sem preços, que é o estado que motivou desligar.
   */
  useEffect(() => {
    if (!COMPRAS_NO_APP_ATIVAS) router.replace('/(tabs)');
  }, [router]);

  useEffect(() => {
    // Não registrar visualização de um paywall que ninguém pode usar: seria
    // poluir o funil de monetização com ruído.
    if (COMPRAS_NO_APP_ATIVAS) track('paywall_viewed', { trigger: 'settings' });
  }, []);
  const isBrl = i18n.language === 'pt-BR';
  const selectedPackage = billing === 'monthly' ? monthlyPackage : yearlyPackage;

  const monthlyPrice = getPrice('monthly');
  const yearlyPrice = getPrice('yearly');
  const pricesLoaded = !!monthlyPrice && !!yearlyPrice;

  const priceLabels = {
    monthly: monthlyPrice ?? '...',
    yearly: yearlyPrice ?? '...',
  };

  const handleSubscribe = async () => {
    if (!selectedPackage) {
      Alert.alert(t('common:error'), t('packageNotAvailable'));
      return;
    }
    track('purchase_started', { selected_plan: billing });
    try {
      await purchase(selectedPackage);
      // purchase_completed is server-sourced — it fires from the RevenueCat
      // webhook, the only signal that actually confirms money moved.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('common:done'), t('subscribed'));
      refreshUsage();
    } catch (err: any) {
      if (err?.userCancelled || err?.message?.includes('canceled')) return;
      console.error('[Pricing] error:', err?.message ?? err);
      // A failed purchase is the one error in this app with direct revenue
      // impact — worth its own report, not just a log line nobody reads.
      captureException(err, { where: 'purchase', billing });
      track('purchase_failed', { selected_plan: billing, reason: err?.message ?? 'unknown' });
      Alert.alert(t('common:error'), err?.message ?? 'Purchase failed');
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await restore();
      if (result.restored) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('common:done'), t('restoreSuccess'));
        refreshUsage();
      } else {
        Alert.alert(t('restoreEmpty'));
      }
    } catch (err: any) {
      captureException(err, { where: 'restorePurchases' });
      Alert.alert(t('common:error'), err?.message ?? 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    Linking.openURL(getManageSubscriptionUrl());
  };

  const handleSelectBilling = (next: Billing) => {
    setBilling(next);
    track('plan_selected', { selected_plan: next });
  };

  const freeFeatures = ['flashcards', 'quizzes', 'documents', 'leagues'] as const;
  const proFeatures = ['flashcards', 'quizzes', 'documents', 'leagues', 'priority', 'noAds'] as const;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => voltar()} style={styles.backBtn}>
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Usage */}
        {usage && (
          <View style={styles.usageCard}>
            <Text style={styles.usageTitle}>{t('usage')}</Text>
            <Text style={styles.usageRow}>
              {usage.plan === 'PRO'
                ? t('unlimited')
                : t('flashcardsUsed', { used: usage.flashcard_sets.used, limit: usage.flashcard_sets.limit })}
            </Text>
            <Text style={styles.usageRow}>
              {usage.plan === 'PRO'
                ? t('unlimited')
                : t('quizzesUsed', { used: usage.quizzes.used, limit: usage.quizzes.limit })}
            </Text>
          </View>
        )}

        {/* Billing Toggle */}
        {!isPro && (
          <View style={styles.billingToggle}>
            <TouchableOpacity
              style={[styles.billingBtn, billing === 'monthly' && styles.billingActive]}
              onPress={() => handleSelectBilling('monthly')}
            >
              <Text style={[styles.billingText, billing === 'monthly' && styles.billingTextActive]}>{t('monthly')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.billingBtn, billing === 'yearly' && styles.billingActive]}
              onPress={() => handleSelectBilling('yearly')}
            >
              <Text style={[styles.billingText, billing === 'yearly' && styles.billingTextActive]}>{t('yearly')}</Text>
              {/* O percentual vem dos preços reais, não do código: com US$ 9,99
                  contra US$ 69,99 o desconto é 42%, e com R$ 19,99 contra
                  R$ 99,99 é 58% — um número fixo estaria errado nos dois. Sem
                  os dois preços, a etiqueta some. */}
              {billing === 'yearly' && economiaAnual
                ? <Text style={styles.saveTag}>{t('savePercent', { percent: economiaAnual })}</Text>
                : null}
            </TouchableOpacity>
          </View>
        )}

        {/* Free Plan Card */}
        <View style={[styles.planCard, isPro && { opacity: 0.6 }]}>
          <Text style={styles.planName}>{t('freePlan')}</Text>
          <Text style={styles.planPrice}>$0</Text>
          {!isPro && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>{t('currentPlan')}</Text>
            </View>
          )}
          {freeFeatures.map((key) => (
            <View key={key} style={styles.featureRow}>
              <Check size={16} color={COLORS.success} />
              <Text style={styles.featureText}>{t(`freeFeatures.${key}`)}</Text>
            </View>
          ))}
        </View>

        {/* Pro Plan Card */}
        <View style={[styles.planCard, styles.proPlanCard]}>
          <View style={styles.proHeader}>
            <Crown size={20} color={COLORS.gold} />
            <Text style={[styles.planName, { color: COLORS.gold, marginLeft: 8 }]}>{t('proPlan')}</Text>
          </View>
          <Text style={styles.planPrice}>
            {priceLabels[billing]}
            <Text style={styles.planPeriod}>{billing === 'monthly' ? t('perMonth') : t('perYear')}</Text>
          </Text>
          {isPro && (
            <View style={[styles.currentBadge, { backgroundColor: COLORS.gold + '22', borderColor: COLORS.gold }]}>
              <Text style={[styles.currentBadgeText, { color: COLORS.gold }]}>{t('currentPlan')}</Text>
            </View>
          )}
          {proFeatures.map((key) => (
            <View key={key} style={styles.featureRow}>
              <Check size={16} color={COLORS.gold} />
              <Text style={styles.featureText}>{t(`proFeatures.${key}`)}</Text>
            </View>
          ))}

          {!isPro && selectedPackage && (
            <View style={styles.subscriptionDisclosure}>
              <Text style={styles.subscriptionName}>
                {selectedPackage.product.title || (billing === 'monthly' ? 'Quibly Pro (Monthly)' : 'Quibly Pro (Yearly)')}
              </Text>
              <Text style={styles.subscriptionDetail}>
                {t('subscriptionDisclosure', {
                  price: priceLabels[billing],
                  period: billing === 'monthly' ? t('monthly').toLowerCase() : t('yearly').toLowerCase(),
                })}
              </Text>
            </View>
          )}

          <Text style={styles.subscriptionTerms}>{t('subscriptionTerms')}</Text>
          <View style={styles.legalLinksRow}>
            <TouchableOpacity onPress={() => Linking.openURL('https://tryquibly.com/terms')}>
              <Text style={styles.legalLinkText}>{t('termsOfUse')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>  |  </Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://tryquibly.com/privacy')}>
              <Text style={styles.legalLinkText}>{t('privacyPolicy')}</Text>
            </TouchableOpacity>
          </View>

          {!isPro ? (
            <TouchableOpacity
              style={[styles.subscribeButton, (purchasing || !pricesLoaded) && { opacity: 0.6 }]}
              activeOpacity={0.8}
              onPress={handleSubscribe}
              disabled={purchasing || !pricesLoaded}
            >
              {purchasing ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <Text style={styles.subscribeButtonText}>{t('subscribe')}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.manageButton} activeOpacity={0.8} onPress={handleManageSubscription}>
              <Text style={styles.manageButtonText}>{t('manageSubscription')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Restore Purchases */}
        {!isPro && (
          <TouchableOpacity
            style={styles.restoreButton}
            activeOpacity={0.7}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator size="small" color={COLORS.textMuted} />
            ) : (
              <>
                <RotateCcw size={16} color={COLORS.textMuted} />
                <Text style={styles.restoreButtonText}>{t('restorePurchases')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
  usageCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  usageTitle: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.textSecondary, marginBottom: 8 },
  usageRow: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.text, marginBottom: 4 },
  billingToggle: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 12, padding: 4, marginBottom: 20 },
  billingBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  billingActive: { backgroundColor: COLORS.primary },
  billingText: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.textMuted },
  billingTextActive: { color: COLORS.onPrimary },
  saveTag: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.success, marginTop: 1 },
  planCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  proPlanCard: { borderColor: COLORS.gold + '40' },
  proHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  planName: { fontSize: 22, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  planPrice: { fontSize: 32, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 12 },
  planPeriod: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted },
  currentBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: COLORS.primary + '22', borderWidth: 1, borderColor: COLORS.primary, marginBottom: 12 },
  currentBadgeText: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.primary, textTransform: 'uppercase' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  featureText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.text },
  subscriptionDisclosure: { backgroundColor: COLORS.surfaceLight ?? COLORS.surface, borderRadius: 10, padding: 12, marginTop: 12 },
  subscriptionName: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.text, marginBottom: 4 },
  subscriptionDetail: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textMuted, lineHeight: 16 },
  subscriptionTerms: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 10, lineHeight: 16 },
  legalLinksRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  legalLinkText: { fontSize: 12, fontFamily: FONTS.semiBold, color: COLORS.primary, textDecorationLine: 'underline' as const },
  legalSeparator: { fontSize: 12, color: COLORS.textMuted },
  subscribeButton: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  subscribeButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.onPrimary },
  manageButton: { backgroundColor: COLORS.surface, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  manageButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text },
  restoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  restoreButtonText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted },
});
