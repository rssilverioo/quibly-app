import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { CheckCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

const FONTS = {
  bold: 'Inter_700Bold',
  semiBold: 'Inter_600SemiBold',
  medium: 'Inter_500Medium',
  regular: 'Inter_400Regular',
};

interface ScoreBreakdown {
  participation_sp: number;
  base_sp: number;
  proof_mode_bonus: number;
  proof_verified_bonus: number;
  pomodoro_bonus: number;
  streak_bonus: number;
  streak_milestone_bonus: number;
  early_exit_penalty: number;
  total_sp: number;
  xp_earned: number;
}

interface SessionCompleteModalProps {
  durationMinutes: number;
  pomodorosCompleted: number;
  totalCycles: number;
  pointsEarned: number;
  xpEarned: number;
  isVerified: boolean;
  subjectName: string;
  score?: ScoreBreakdown;
  onDismiss: () => void;
}

export default function SessionCompleteModal({
  durationMinutes,
  pomodorosCompleted,
  totalCycles,
  pointsEarned,
  xpEarned,
  isVerified,
  subjectName,
  score,
  onDismiss,
}: SessionCompleteModalProps) {
  const { t } = useTranslation('session');

  React.useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const formatDuration = (mins: number): string => {
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''}`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    if (remaining === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${hours}h ${remaining}m`;
  };

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Title */}
          <Text style={styles.title}>{t('complete.title')}</Text>
          <View style={styles.divider} />

          {/* Points (prominent) */}
          <View style={styles.pointsContainer}>
            <Text style={styles.pointsLabel}>{t('complete.pointsEarned')}</Text>
            <Text style={styles.pointsValue}>+{pointsEarned} SP</Text>
          </View>

          <View style={styles.xpContainer}>
            <Text style={styles.xpValue}>+{xpEarned} XP</Text>
          </View>

          {/* Verified Badge */}
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <CheckCircle size={16} color={COLORS.success} />
              <Text style={styles.verifiedText}>{t('complete.verifiedSession')}</Text>
            </View>
          )}

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatDuration(durationMinutes)}</Text>
              <Text style={styles.statLabel}>{t('complete.duration')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{subjectName}</Text>
              <Text style={styles.statLabel}>{t('complete.subject')}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {t('complete.cyclesCount', { completed: pomodorosCompleted, total: totalCycles })}
              </Text>
              <Text style={styles.statLabel}>{t('complete.pomodoros')}</Text>
            </View>
          </View>

          {/* Score Breakdown */}
          <View style={styles.breakdownContainer}>
            <Text style={styles.breakdownTitle}>{t('complete.scoreBreakdown')}</Text>
            {score ? (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{t('complete.showingUp')}</Text>
                  <Text style={styles.breakdownValueBonus}>+{score.participation_sp} SP</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{t('complete.studyTime')}</Text>
                  <Text style={styles.breakdownValue}>{score.base_sp} SP</Text>
                </View>
                {score.proof_mode_bonus > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('complete.proofModeBonus')}</Text>
                    <Text style={styles.breakdownValueBonus}>+{score.proof_mode_bonus} SP</Text>
                  </View>
                )}
                {score.proof_verified_bonus > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('complete.allVerifiedBonus')}</Text>
                    <Text style={styles.breakdownValueBonus}>+{score.proof_verified_bonus} SP</Text>
                  </View>
                )}
                {score.pomodoro_bonus > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('complete.pomodoroBonus')}</Text>
                    <Text style={styles.breakdownValueBonus}>+{score.pomodoro_bonus} SP</Text>
                  </View>
                )}
                {score.streak_bonus > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('complete.streakBonus')}</Text>
                    <Text style={styles.breakdownValueBonus}>+{score.streak_bonus} SP</Text>
                  </View>
                )}
                {score.streak_milestone_bonus > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('complete.streakMilestone')}</Text>
                    <Text style={styles.breakdownValueBonus}>+{score.streak_milestone_bonus} SP</Text>
                  </View>
                )}
                {score.early_exit_penalty > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('complete.earlyExitPenalty')}</Text>
                    <Text style={styles.breakdownValuePenalty}>-{score.early_exit_penalty} SP</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{t('complete.baseSP')}</Text>
                  <Text style={styles.breakdownValue}>{durationMinutes} SP</Text>
                </View>
                {pomodorosCompleted > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('complete.pomodoroBonus')}</Text>
                    <Text style={styles.breakdownValueBonus}>+{pomodorosCompleted * 5} SP</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Done Button */}
          <TouchableOpacity
            style={styles.doneButton}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>{t('common:done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Title
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontFamily: FONTS.bold,
    marginBottom: 16,
  },
  divider: {
    width: 40,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginBottom: 24,
  },
  // Points
  pointsContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  pointsLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontFamily: FONTS.medium,
    marginBottom: 4,
  },
  pointsValue: {
    color: COLORS.primary,
    fontSize: 42,
    fontFamily: FONTS.bold,
    letterSpacing: 1,
  },
  xpContainer: {
    marginBottom: 16,
  },
  xpValue: {
    color: COLORS.secondary,
    fontSize: 20,
    fontFamily: FONTS.bold,
  },
  // Verified Badge
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '18',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
    gap: 6,
  },
  verifiedCheck: {
    color: COLORS.success,
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  verifiedText: {
    color: COLORS.success,
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    marginBottom: 2,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
  // Breakdown
  breakdownContainer: {
    width: '100%',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    marginTop: 8,
  },
  breakdownTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  breakdownValue: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  breakdownValueBonus: {
    color: COLORS.secondary,
    fontSize: 13,
    fontFamily: FONTS.semiBold,
  },
  breakdownValuePenalty: {
    color: COLORS.error,
    fontSize: 13,
    fontFamily: FONTS.semiBold,
  },
  // Done
  doneButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: COLORS.text,
    fontSize: 17,
    fontFamily: FONTS.bold,
  },
});
