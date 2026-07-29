import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Minus, Plus, PartyPopper } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { createLeague } from '../../services/leagues';
import type { League, LeagueMode, LeaguePrivacy } from '@quibly/shared';
import { inviteUrl } from '@quibly/shared/constants';
import { staticDark as c } from '../../theme';
import { track } from '../../lib/analytics';

const COLORS = {
  background: c.bg,
  surface: c.bg,
  surfaceLight: c.surface,
  border: c.surfaceRaised,
  primary: c.accent,
  primaryLight: c.accent,
  secondary: c.accent,
  accent: c.danger,
  warning: c.warning,
  success: c.accent,
  error: c.danger,
  text: c.fg,
  textSecondary: c.fgSubtle,
  textMuted: c.fgMuted,
  gold: c.gold,
  silver: c.silver,
  bronze: c.bronze,
};

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateISO(date);
}

export default function CreateLeagueScreen() {
  const { t } = useTranslation('leagues');
  const { user } = useAuth();

  const modeOptions = useMemo(() => [
    { key: 'easy' as LeagueMode, label: t('modes.easy'), description: t('modes.easyDescription'), color: COLORS.success },
    { key: 'competitive' as LeagueMode, label: t('modes.competitive'), description: t('modes.competitiveDescription'), color: COLORS.primary },
    { key: 'hardcore' as LeagueMode, label: t('modes.hardcore'), description: t('modes.hardcoreDescription'), color: COLORS.accent },
  ], [t]);

  const quickDurations = useMemo(() => [
    { label: t('create.quickDuration.7days'), days: 7 },
    { label: t('create.quickDuration.30days'), days: 30 },
    { label: t('create.quickDuration.90days'), days: 90 },
    { label: t('create.quickDuration.1year'), days: 365 },
  ], [t]);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(formatDateISO(new Date()));
  const [endDate, setEndDate] = useState(addDays(formatDateISO(new Date()), 30));
  const [mode, setMode] = useState<LeagueMode>('competitive');
  const [privacy, setPrivacy] = useState<LeaguePrivacy>('private');
  const [maxMembers, setMaxMembers] = useState(50);
  const [creating, setCreating] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Success state
  const [createdLeague, setCreatedLeague] = useState<League | null>(null);

  const handleQuickDuration = (days: number) => {
    setEndDate(addDays(startDate, days));
  };

  const handleStartDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    if (date) setStartDate(formatDateISO(date));
  };

  const handleEndDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    if (date) setEndDate(formatDateISO(date));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(t('common:error'), t('create.nameRequired'));
      return;
    }
    if (!displayName.trim()) {
      Alert.alert(t('common:error'), t('create.displayNameRequired'));
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert(t('common:error'), t('create.datesRequired'));
      return;
    }
    if (!user) {
      Alert.alert(t('common:error'), t('create.loginRequired'));
      return;
    }

    setCreating(true);
    try {
      const league = await createLeague(user.uid, {
        name: name.trim(),
        description: description.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
        privacy,
        mode,
        max_members: maxMembers,
        display_name: displayName.trim(),
      });
      setCreatedLeague(league);
      track('room_created', { mode, privacy });
    } catch (err: any) {
      Alert.alert(t('common:error'), err?.message ?? t('create.createError'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!createdLeague) return;
    try {
      const result = await Share.share({ message: inviteUrl(createdLeague.invite_code) });
      if (result.action === Share.sharedAction) track('invite_shared', { room_id: createdLeague.id });
    } catch {
      // User cancelled
    }
  };

  const handleShare = async () => {
    if (!createdLeague) return;
    try {
      const result = await Share.share({
        message: t('create.shareMessage', { name: createdLeague.name, url: inviteUrl(createdLeague.invite_code) }),
      });
      if (result.action === Share.sharedAction) track('invite_shared', { room_id: createdLeague.id });
    } catch {
      // User cancelled share
    }
  };

  const handleGoToLeague = () => {
    if (!createdLeague) return;
    router.replace(`/league/${createdLeague.id}`);
  };

  // Success Screen
  if (createdLeague) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.successContainer}>
          <PartyPopper size={56} color={COLORS.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.successTitle}>{t('created.title')}</Text>
          <Text style={styles.successSubtitle}>{t('created.subtitle')}</Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>{t('created.inviteCode')}</Text>
            <Text style={styles.codeText}>{createdLeague.invite_code}</Text>
          </View>

          <View style={styles.successActions}>
            <TouchableOpacity
              style={styles.successButton}
              onPress={handleCopyCode}
              activeOpacity={0.7}
            >
              <Text style={styles.successButtonText}>{t('created.copyCode')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.successButton, styles.successButtonOutline]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Text style={[styles.successButtonText, styles.successButtonOutlineText]}>{t('created.share')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.goToLeagueButton}
            onPress={handleGoToLeague}
            activeOpacity={0.7}
          >
            <Text style={styles.goToLeagueText}>{t('created.goToLeague')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <ArrowLeft size={18} color={COLORS.primaryLight} style={{ marginRight: 4 }} />
            <Text style={styles.backButtonText}>{t('common:back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('create.title')}</Text>
        </View>

        {/* League Name */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('create.leagueName')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('create.leagueNamePlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={name}
            onChangeText={setName}
            autoCorrect={false}
            selectionColor={COLORS.primaryLight}
            maxLength={60}
          />
        </View>

        {/* Display Name */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('create.displayName')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('create.displayNamePlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            autoCorrect={false}
            selectionColor={COLORS.primaryLight}
            maxLength={30}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>
            {t('create.description')} <Text style={styles.labelOptional}>{t('common:optional')}</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={t('create.descriptionPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            selectionColor={COLORS.primaryLight}
            maxLength={300}
          />
        </View>

        {/* Start Date */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('create.startDate')}</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.dateButtonText}>{formatDateDisplay(startDate)}</Text>
          </TouchableOpacity>
          {Platform.OS === 'android' && showStartPicker && (
            <DateTimePicker
              value={parseISODate(startDate)}
              mode="date"
              minimumDate={new Date()}
              onChange={handleStartDateChange}
            />
          )}
        </View>

        {/* End Date */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('create.endDate')}</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowEndPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.dateButtonText}>{formatDateDisplay(endDate)}</Text>
          </TouchableOpacity>
          {Platform.OS === 'android' && showEndPicker && (
            <DateTimePicker
              value={parseISODate(endDate)}
              mode="date"
              minimumDate={parseISODate(addDays(startDate, 1))}
              onChange={handleEndDateChange}
            />
          )}
        </View>

        {/* iOS Date Picker Modal */}
        {Platform.OS === 'ios' && (showStartPicker || showEndPicker) && (
          <Modal transparent animationType="fade">
            <TouchableOpacity
              style={styles.pickerOverlay}
              activeOpacity={1}
              onPress={() => { setShowStartPicker(false); setShowEndPicker(false); }}
            >
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>
                    {showStartPicker ? t('create.startDate') : t('create.endDate')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { setShowStartPicker(false); setShowEndPicker(false); }}
                  >
                    <Text style={styles.pickerDone}>{t('common:done')}</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={showStartPicker ? parseISODate(startDate) : parseISODate(endDate)}
                  mode="date"
                  display="spinner"
                  minimumDate={showStartPicker ? new Date() : parseISODate(addDays(startDate, 1))}
                  onChange={showStartPicker ? handleStartDateChange : handleEndDateChange}
                  textColor={COLORS.text}
                  themeVariant="dark"
                />
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Quick Duration Buttons */}
        <View style={styles.quickDurationRow}>
          {quickDurations.map((item) => {
            const isSelected = endDate === addDays(startDate, item.days);
            return (
              <TouchableOpacity
                key={item.days}
                style={[styles.quickDurationButton, isSelected && styles.quickDurationButtonActive]}
                onPress={() => handleQuickDuration(item.days)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.quickDurationText, isSelected && styles.quickDurationTextActive]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Mode Selector */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('create.mode')}</Text>
          <View style={styles.modeGrid}>
            {modeOptions.map((option) => {
              const isSelected = mode === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.modeCard,
                    isSelected && { borderColor: option.color, backgroundColor: option.color + '11' },
                  ]}
                  onPress={() => setMode(option.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modeLabel, isSelected && { color: option.color }]}>
                    {option.label}
                  </Text>
                  <Text style={styles.modeDescription}>{option.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Privacy Toggle */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('create.privacy')}</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, privacy === 'public' && styles.toggleButtonActive]}
              onPress={() => setPrivacy('public')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.toggleText, privacy === 'public' && styles.toggleTextActive]}
              >
                {t('common:public')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, privacy === 'private' && styles.toggleButtonActive]}
              onPress={() => setPrivacy('private')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.toggleText, privacy === 'private' && styles.toggleTextActive]}
              >
                {t('common:private')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Max Members Slider */}
        <View style={styles.field}>
          <View style={styles.sliderHeader}>
            <Text style={styles.label}>{t('create.maxMembers')}</Text>
            <Text style={styles.sliderValue}>{maxMembers}</Text>
          </View>
          <View style={styles.sliderRow}>
            <TouchableOpacity
              style={styles.sliderButton}
              onPress={() => setMaxMembers(Math.max(2, maxMembers - 5))}
              activeOpacity={0.7}
            >
              <Minus size={18} color={COLORS.text} />
            </TouchableOpacity>

            <View style={styles.sliderTrack}>
              <View
                style={[styles.sliderFill, { width: `${((maxMembers - 2) / 98) * 100}%` }]}
              />
            </View>

            <TouchableOpacity
              style={styles.sliderButton}
              onPress={() => setMaxMembers(Math.min(100, maxMembers + 5))}
              activeOpacity={0.7}
            >
              <Plus size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabelText}>2</Text>
            <Text style={styles.sliderLabelText}>100</Text>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.7}
        >
          {creating ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <Text style={styles.createButtonText}>{t('create.createButton')}</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Header
  header: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButtonText: {
    color: COLORS.primaryLight,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },

  // Fields
  field: {
    marginBottom: 20,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  labelOptional: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
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
  inputMultiline: {
    minHeight: 80,
    paddingTop: 14,
  },
  dateButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateButtonText: {
    color: COLORS.text,
    fontSize: 16,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  pickerDone: {
    color: COLORS.primaryLight,
    fontSize: 16,
    fontWeight: '600',
  },

  // Quick Duration
  quickDurationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quickDurationButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  quickDurationButtonActive: {
    backgroundColor: COLORS.primary + '22',
    borderColor: COLORS.primary,
  },
  quickDurationText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  quickDurationTextActive: {
    color: COLORS.primaryLight,
  },

  // Mode
  modeGrid: {
    gap: 10,
  },
  modeCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
  },
  modeLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  // Privacy Toggle
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary + '22',
    borderColor: COLORS.primary,
  },
  toggleText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.primaryLight,
  },

  // Slider
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderValue: {
    color: COLORS.primaryLight,
    fontSize: 18,
    fontWeight: '700',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderButton: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderButtonText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '600',
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    marginTop: 4,
  },
  sliderLabelText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },

  // Create Button
  createButton: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },

  // Success Screen
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  successTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  successSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginBottom: 32,
  },
  codeBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  codeLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeText: {
    color: COLORS.primaryLight,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 4,
  },
  successActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  successButton: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  successButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  successButtonOutlineText: {
    color: COLORS.primaryLight,
  },
  goToLeagueButton: {
    paddingVertical: 12,
  },
  goToLeagueText: {
    color: COLORS.primaryLight,
    fontSize: 15,
    fontWeight: '600',
  },
});
