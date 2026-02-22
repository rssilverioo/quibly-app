import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Flame, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { COLORS, FONTS } from '@quibly/shared/constants';
import { getStudyDates, type StudyDate } from '../services/sessions';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 40 - 48) / 7);

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEK_DAYS_PT = ['Do', 'Se', 'Te', 'Qu', 'Qi', 'Se', 'Sa'];

interface StreakCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  currentStreak: number;
  longestStreak: number;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function StreakCalendarModal({
  visible,
  onClose,
  currentStreak,
  longestStreak,
}: StreakCalendarModalProps) {
  const { t, i18n } = useTranslation('home');
  const isPt = i18n.language?.startsWith('pt');
  const monthNames = isPt ? MONTH_NAMES_PT : MONTH_NAMES_EN;
  const weekDays = isPt ? WEEK_DAYS_PT : WEEK_DAYS;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [studyDates, setStudyDates] = useState<StudyDate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDates = useCallback(async () => {
    setIsLoading(true);
    try {
      const dates = await getStudyDates(year, month);
      setStudyDates(dates);
    } catch {
      setStudyDates([]);
    }
    setIsLoading(false);
  }, [year, month]);

  useEffect(() => {
    if (visible) fetchDates();
  }, [visible, fetchDates]);

  const goToPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const goToNextMonth = () => {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    if (isCurrentMonth) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const studyMap = new Map(studyDates.map(d => [d.date, d.minutes]));
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const daysStudied = studyDates.length;
  const totalMinutes = studyDates.reduce((sum, d) => sum + d.minutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('streakCalendar.title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <Flame size={20} color={COLORS.warning} fill={COLORS.warning} />
            <Text style={styles.streakValue}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>{t('streakCalendar.current')}</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Flame size={20} color={COLORS.accent} fill={COLORS.accent} />
            <Text style={styles.streakValue}>{longestStreak}</Text>
            <Text style={styles.streakLabel}>{t('streakCalendar.longest')}</Text>
          </View>
        </View>

        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
            <ChevronLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {monthNames[month - 1]} {year}
          </Text>
          <TouchableOpacity
            onPress={goToNextMonth}
            style={styles.navButton}
            disabled={isCurrentMonth}
          >
            <ChevronRight size={24} color={isCurrentMonth ? COLORS.textMuted : COLORS.text} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : (
          <>
            <View style={styles.weekRow}>
              {weekDays.map((day, i) => (
                <View key={i} style={styles.weekCell}>
                  <Text style={styles.weekDayText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {cells.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const minutes = studyMap.get(dateStr);
                const isStudied = minutes !== undefined;
                const isToday = isCurrentMonth && day === today;

                return (
                  <View key={day} style={styles.dayCell}>
                    <View
                      style={[
                        styles.dayCircle,
                        isStudied && styles.dayCircleStudied,
                        isToday && styles.dayCircleToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isStudied && styles.dayTextStudied,
                          isToday && !isStudied && styles.dayTextToday,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={styles.footer}>
          <View style={styles.footerStat}>
            <Text style={styles.footerValue}>{daysStudied}</Text>
            <Text style={styles.footerLabel}>{t('streakCalendar.daysStudied')}</Text>
          </View>
          <View style={styles.footerDivider} />
          <View style={styles.footerStat}>
            <Text style={styles.footerValue}>
              {totalHours}h {remainingMinutes}m
            </Text>
            <Text style={styles.footerLabel}>{t('streakCalendar.totalTime')}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  streakItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  streakValue: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  streakLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  streakDivider: {
    width: 1,
    height: 48,
    backgroundColor: COLORS.border,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  loadingContainer: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayCircle: {
    width: CELL_SIZE - 8,
    height: CELL_SIZE - 8,
    borderRadius: (CELL_SIZE - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleStudied: {
    backgroundColor: COLORS.primary,
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  dayText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  dayTextStudied: {
    color: COLORS.text,
    fontFamily: FONTS.bold,
  },
  dayTextToday: {
    color: COLORS.text,
    fontFamily: FONTS.bold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  footerStat: {
    flex: 1,
    alignItems: 'center',
  },
  footerValue: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  footerLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  footerDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },
});
