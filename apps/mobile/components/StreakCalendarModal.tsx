import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useTheme, type Palette, radius, space, text } from '../theme';
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
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
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
            <X size={24} color={c.fgMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <Flame size={20} color={c.warning} fill={c.warning} />
            <Text style={styles.streakValue}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>{t('streakCalendar.current')}</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Flame size={20} color={c.accent} fill={c.accent} />
            <Text style={styles.streakValue}>{longestStreak}</Text>
            <Text style={styles.streakLabel}>{t('streakCalendar.longest')}</Text>
          </View>
        </View>

        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
            <ChevronLeft size={24} color={c.fg} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {monthNames[month - 1]} {year}
          </Text>
          <TouchableOpacity
            onPress={goToNextMonth}
            style={styles.navButton}
            disabled={isCurrentMonth}
          >
            <ChevronRight size={24} color={isCurrentMonth ? c.fgSubtle : c.fg} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={c.accent} />
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

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
    paddingHorizontal: 20,
    paddingTop: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xl,
  },
  headerTitle: {
    ...text.title2,
    color: c.fg,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    padding: space.lg,
    marginBottom: space.xl,
    borderWidth: 1,
    borderColor: c.border,
  },
  streakItem: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
  },
  streakValue: {
    ...text.title2,
    color: c.fg,
  },
  streakLabel: {
    ...text.overline,
    color: c.fgMuted,
  },
  streakDivider: {
    width: 1,
    height: 48,
    backgroundColor: c.border,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  navButton: {
    padding: space.sm,
  },
  monthTitle: {
    ...text.title3,
    color: c.fg,
  },
  loadingContainer: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: space.sm,
  },
  weekCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  // Era `textMuted` (= `fgSubtle`): a sobrancelha da semana precisa ser lida
  // para o calendário funcionar, então é `fgMuted`. `fgSubtle` fica para o que
  // está desabilitado — aqui, só o chevron do mês futuro.
  weekDayText: {
    ...text.overline,
    color: c.fgMuted,
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
    marginBottom: space.xs,
  },
  dayCircle: {
    width: CELL_SIZE - 8,
    height: CELL_SIZE - 8,
    borderRadius: (CELL_SIZE - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleStudied: {
    backgroundColor: c.accent,
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: c.fg,
  },
  dayText: {
    ...text.label,
    color: c.fgMuted,
  },
  // O dia estudado é um disco de `accent`; o número em cima dele é
  // `fgOnAccent`. Era `c.fg`, near-black sobre azul — 2,1:1, ilegível.
  dayTextStudied: {
    color: c.fgOnAccent,
    fontFamily: text.bodyStrong.fontFamily,
  },
  dayTextToday: {
    color: c.fg,
    fontFamily: text.bodyStrong.fontFamily,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    padding: space.lg,
    marginTop: space.xl,
    borderWidth: 1,
    borderColor: c.border,
  },
  footerStat: {
    flex: 1,
    alignItems: 'center',
  },
  footerValue: {
    ...text.title3,
    fontFamily: text.bodyStrong.fontFamily,
    color: c.fg,
    marginBottom: space.xs,
  },
  footerLabel: {
    ...text.caption,
    color: c.fgMuted,
  },
  footerDivider: {
    width: 1,
    height: 32,
    backgroundColor: c.border,
  },
});
