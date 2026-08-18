import React, { useEffect, useState } from 'react';
import { COMPRAS_NO_APP_ATIVAS, revenueCatConfigError } from '../../services/iap';
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
  const { monthlyPackage, yearlyPackage, purchasing, purchase, restore, getPrice, diasDeTeste, economiaAnual, getManageSubscriptionUrl } = useIAP();
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

  /**
   * Quando o build subiu sem chave de verdade.
   *
   * Sem isto a tela cai no estado sem preço — e vazio **mente**: é
   * indistinguível de "ainda carregando" e de "sem produtos nesta região". O
   * RevenueCat aceita uma chave inválida e só falha depois, no `getOfferings`,
   * que tem `catch` e devolve `null`.
   *
   * Hoje isso vale para o Android, cuja chave ainda é o placeholder do
   * `eas.json`. Quem abre a tela lá precisa ler o motivo, não ficar olhando
   * três pontinhos que nunca viram preço.
   */
  const erroDeConfig = revenueCatConfigError();

  const priceLabels = {
    monthly: monthlyPrice ?? '...',
    yearly: yearlyPrice ?? '...',
  };

  const periodLabel = billing === 'monthly' ? t('perMonth') : t('perYear');

  /**
   * Os dias de teste desta pessoa, neste ciclo — `null` quando não há o que
   * prometer.
   *
   * Vem do hook, que só devolve número quando a oferta existe no produto **e**
   * a conta ainda tem direito a ela. Quem já usou os 7 dias vê o preço cheio,
   * que é exatamente o que a Apple vai cobrar dela.
   */
  const diasDeTesteAtual = diasDeTeste(billing);

  const handleSubscribe = async () => {
    if (!selectedPackage) {
      Alert.alert(t('common:error'), t('packageNotAvailable'));
      return;
    }
    // `trial_days` aqui é o que separa "assinou" de "começou o teste" no funil.
    // Sem ele, a queda de conversão paga logo depois de ligar o teste ficaria
    // sem explicação — e a explicação é que a cobrança mudou de dia, não sumiu.
    track('purchase_started', { selected_plan: billing, trial_days: diasDeTesteAtual ?? 0 });
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

  /**
   * O que cada plano dá — descrito pelo produto que existe.
   *
   * Era flashcards, quizzes, upload de documentos e IA prioritária: o produto
   * anterior. A pessoa lia isso na tela onde decide pagar, e nada daquilo
   * acontece hoje.
   *
   * As três linhas repetidas nos dois planos são de propósito. Elas não
   * vendem o Pro — dizem que o cronômetro, o mapa e entrar em salas dos outros
   * **não** são pagos. Numa tela de assinatura, dizer o que continua grátis
   * evita a suspeita de que o resto vai virar pago depois.
   */
  const freeFeatures = ['rooms', 'joining', 'timer', 'streaks'] as const;
  const proFeatures = ['rooms', 'joining', 'timer', 'streaks', 'noAds'] as const;

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

        {/*
          O bloco de uso saiu.

          Ele contava flashcards e quizzes — o produto anterior — e mostrava
          "0 / -1", porque `-1` é o sentinela de ilimitado do servidor vazando
          para a tela. Um número negativo no lugar de um limite é pior que não
          mostrar nada.

          O que valeria mostrar aqui é quantas salas próprias a pessoa já tem,
          que é o limite que o plano de fato guarda. Mas esse número vive no
          servidor (`FREE_ROOMS`) e não está em `useUsage`, e uma tela de
          assinatura não é o lugar de descobrir isso — a folha do Pro já diz o
          limite no momento em que ele é atingido, com o número vindo de lá.
        */}

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
          {/*
            Com teste, o preço não é a manchete — o teste é.

            A ordem importa: quem lê "R$ 19,90/mês" primeiro já decidiu antes de
            chegar na linha de baixo. E o preço não some, vem logo embaixo com o
            "depois", porque esconder quanto custa depois do grátis é a
            reclamação que vira estorno.
          */}
          {diasDeTesteAtual ? (
            <>
              <Text style={styles.planPrice}>{t('trialHeadline', { days: diasDeTesteAtual })}</Text>
              <Text style={styles.trialThen}>
                {t('trialThen', { price: priceLabels[billing], period: periodLabel })}
              </Text>
            </>
          ) : (
            <Text style={styles.planPrice}>
              {priceLabels[billing]}
              <Text style={styles.planPeriod}>{periodLabel}</Text>
            </Text>
          )}
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
              {/*
                A divulgação muda quando há teste, e não é preciosismo de
                redação: a regra da Apple (3.1.2) exige que a duração do teste,
                o preço depois dele e a renovação automática apareçam **juntos**
                onde a compra acontece. O texto sem teste diria que a cobrança é
                hoje, e ela não é.
              */}
              <Text style={styles.subscriptionDetail}>
                {diasDeTesteAtual
                  ? t('trialDisclosure', {
                      days: diasDeTesteAtual,
                      price: priceLabels[billing],
                      period: billing === 'monthly' ? t('monthly').toLowerCase() : t('yearly').toLowerCase(),
                    })
                  : t('subscriptionDisclosure', {
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
            {/* O motivo, quando não há preço por falta de chave. Sem esta
                faixa a tela mostra "..." para sempre, e ninguém sabe por quê. */}
            {erroDeConfig ? (
              <Text style={styles.avisoConfig}>{erroDeConfig}</Text>
            ) : null}

            <TouchableOpacity onPress={() => Linking.openURL('https://tryquibly.com/privacy')}>
              <Text style={styles.legalLinkText}>{t('privacyPolicy')}</Text>
            </TouchableOpacity>
          </View>

          {!isPro ? (
            <>
              <TouchableOpacity
                style={[styles.subscribeButton, (purchasing || !pricesLoaded) && { opacity: 0.6 }]}
                activeOpacity={0.8}
                onPress={handleSubscribe}
                disabled={purchasing || !pricesLoaded}
              >
                {purchasing ? (
                  <ActivityIndicator color={COLORS.background} />
                ) : (
                  <Text style={styles.subscribeButtonText}>
                    {diasDeTesteAtual ? t('startTrial', { days: diasDeTesteAtual }) : t('subscribe')}
                  </Text>
                )}
              </TouchableOpacity>
              {/* As duas frases que respondem o que trava o dedo em cima do
                  botão: "vou ser cobrado agora?" e "consigo sair?". Elas estão
                  no texto legal logo acima, e ninguém lê texto legal. */}
              {diasDeTesteAtual ? (
                <Text style={styles.trialReassurance}>{t('trialNoCharge')}</Text>
              ) : null}
            </>
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
  // O preço depois do teste: menor que a manchete, e ainda assim legível — é o
  // número que a pessoa vai ser cobrada, não uma nota de rodapé.
  trialThen: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.textSecondary, marginTop: -6, marginBottom: 12 },
  trialReassurance: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted, textAlign: 'center', marginTop: 8 },
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
  avisoConfig: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
  },
  subscribeButton: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  subscribeButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.onPrimary },
  manageButton: { backgroundColor: COLORS.surface, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  manageButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text },
  restoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  restoreButtonText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted },
});
