import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Users, Calendar, Shield } from 'lucide-react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { getLeaguePreview, joinLeague, type LeaguePreview } from '../../../services/leagues';

const COLORS = {
  background: '#0A0A0F',
  surface: '#141420',
  surfaceLight: '#1E1E2E',
  border: '#2A2A3E',
  primary: '#1E40AF',
  primaryLight: '#2B53D8',
  secondary: '#00D4AA',
  accent: '#FF6B6B',
  warning: '#FFB84D',
  success: '#00D4AA',
  error: '#FF4757',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
};

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`;
}

export default function JoinLeagueScreen() {
  const { t } = useTranslation('leagues');
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();

  const modeStyles = useMemo(() => ({
    easy: { bg: COLORS.success + '22', text: COLORS.success, label: t('modes.easy') },
    competitive: { bg: COLORS.primary + '22', text: COLORS.primaryLight, label: t('modes.competitive') },
    hardcore: { bg: COLORS.accent + '22', text: COLORS.accent, label: t('modes.hardcore') },
  }), [t]);

  const [preview, setPreview] = useState<LeaguePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [joining, setJoining] = useState(false);

  const fetchPreview = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getLeaguePreview(code);
      setPreview(data);
    } catch (err: any) {
      setError(err?.message ?? t('join.invalidOrExpired'));
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (user && code) fetchPreview();
  }, [user, code, fetchPreview]);

  const handleJoin = async () => {
    if (!code || !user || !displayName.trim()) return;
    setJoining(true);
    try {
      const league = await joinLeague(user.uid, code, displayName.trim());
      Alert.alert(t('join.joinedTitle'), t('join.joinedMessage', { name: league.name }), [
        { text: t('common:ok'), onPress: () => router.replace(`/league/${league.id}`) },
      ]);
    } catch (err: any) {
      Alert.alert(t('common:error'), err?.message ?? t('join.joinError'));
    } finally {
      setJoining(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Error
  if (error || !preview) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backRow}>
              <ArrowLeft size={18} color={COLORS.primaryLight} style={{ marginRight: 4 }} />
              <Text style={styles.backText}>{t('common:back')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.center}>
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.errorTitle}>{t('join.invalidInvite')}</Text>
            <Text style={styles.errorMessage}>{error ?? t('join.leagueNotFound')}</Text>
            <TouchableOpacity style={styles.errorButton} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.errorButtonText}>{t('common:goBack')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const modeStyle = modeStyles[preview.mode as keyof typeof modeStyles] ?? modeStyles.easy;

  // Already a member
  if (preview.is_member) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backRow}>
              <ArrowLeft size={18} color={COLORS.primaryLight} style={{ marginRight: 4 }} />
              <Text style={styles.backText}>{t('common:back')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.center}>
            <Text style={styles.successTitle}>{t('join.alreadyMember')}</Text>
            <Text style={styles.successMessage}>{t('join.alreadyInLeague', { name: preview.name })}</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace(`/league/${preview.id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>{t('join.goToLeague')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Full or completed
  const isBlocked = preview.is_full || preview.status === 'completed';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backRow}>
            <ArrowLeft size={18} color={COLORS.primaryLight} style={{ marginRight: 4 }} />
            <Text style={styles.backText}>{t('common:back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('join.title')}</Text>
        </View>

        {/* Preview Card */}
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewName} numberOfLines={2}>{preview.name}</Text>
            <View style={[styles.modeBadge, { backgroundColor: modeStyle.bg }]}>
              <Text style={[styles.modeBadgeText, { color: modeStyle.text }]}>{modeStyle.label}</Text>
            </View>
          </View>

          {preview.description ? (
            <Text style={styles.previewDescription}>{preview.description}</Text>
          ) : null}

          <View style={styles.previewMeta}>
            <View style={styles.metaItem}>
              <Calendar size={14} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{formatDateRange(preview.start_date, preview.end_date)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Users size={14} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{t('join.membersCount', { current: preview.member_count, max: preview.max_members })}</Text>
            </View>
            <View style={styles.metaItem}>
              <Shield size={14} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{preview.privacy === 'public' ? t('common:public') : t('common:private')}</Text>
            </View>
          </View>

          {preview.status === 'completed' && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>{t('join.leagueEnded')}</Text>
            </View>
          )}

          {preview.is_full && preview.status !== 'completed' && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>{t('join.leagueFull')}</Text>
            </View>
          )}
        </View>

        {/* Join Form */}
        {!isBlocked && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>{t('join.displayName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('join.displayNamePlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                value={displayName}
                onChangeText={setDisplayName}
                autoCorrect={false}
                maxLength={30}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, (!displayName.trim() || joining) && styles.buttonDisabled]}
              onPress={handleJoin}
              disabled={!displayName.trim() || joining}
              activeOpacity={0.7}
            >
              {joining ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Text style={styles.primaryButtonText}>{t('join.joinButton')}</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {isBlocked && (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.secondaryButtonText}>{t('common:goBack')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  // Header
  header: { paddingTop: 12, paddingBottom: 8 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { color: COLORS.primaryLight, fontSize: 16, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '700', marginBottom: 20 },

  // Preview Card
  previewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewName: { color: COLORS.text, fontSize: 22, fontWeight: '700', flex: 1, marginRight: 10 },
  modeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  modeBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewDescription: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  previewMeta: { gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { color: COLORS.textSecondary, fontSize: 13 },
  warningBanner: {
    backgroundColor: COLORS.warning + '18',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  warningText: { color: COLORS.warning, fontSize: 13, fontWeight: '600' },

  // Form
  field: { marginBottom: 20 },
  label: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
  },

  // Buttons
  primaryButton: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  secondaryButton: {
    height: 48,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },

  // Error state
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.error + '22',
    color: COLORS.error,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 56,
    marginBottom: 16,
    overflow: 'hidden',
  },
  errorTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  errorMessage: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  errorButtonText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },

  // Already member
  successTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  successMessage: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24 },
});
