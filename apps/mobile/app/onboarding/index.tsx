import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight, Check, BookOpen, GraduationCap, Target, Sparkles, Clock, Flame,
} from 'lucide-react-native';

import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import Press from '../../components/ui/Press';
import { MascotBlock } from '../../components/mascot';
import { useTheme, text as t, space, radius, SUBJECT_COLORS } from '../../theme';
import { track } from '../../lib/analytics';

const { width: W } = Dimensions.get('window');

const EDUCATION_OPTIONS = [
  { id: 'high_school', icon: BookOpen },
  { id: 'college', icon: GraduationCap },
  { id: 'graduate', icon: Target },
  { id: 'professional', icon: Sparkles },
];

const GOAL_OPTIONS = [
  { id: 'exam_prep', icon: Target },
  { id: 'school', icon: BookOpen },
  { id: 'certification', icon: GraduationCap },
  { id: 'fun', icon: Sparkles },
];

/** Keys match the `onboarding.subjects` translation table. */
const SUBJECT_KEYS = [
  'Mathematics', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography',
  'English', 'Computer Science', 'Law', 'Medicine', 'Business', 'Art',
];

const TIME_OPTIONS = [
  { minutes: 5, icon: Clock },
  { minutes: 15, icon: Clock },
  { minutes: 30, icon: Flame },
  { minutes: 60, icon: Flame },
];

/** Name, level, goal, subjects, daily goal. The old pure-welcome step is
 *  folded into the first one — a screen with nothing to answer is pure drop-off. */
const TOTAL_STEPS = 5;

/**
 * Um coelho por passo, um estado por passo — é onde ele mais trabalha
 * (`MARCA §5`, `DESIGN-GYMRATS §3.3`). Tamanho 132 em todos; não varia por
 * passo, porque variar tamanho é a diferença entre mascote e enfeite.
 */
const STEP_MASCOTS = ['wave', 'thinking', 'reading', 'focused', 'happy'] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const { t: tr } = useTranslation('onboarding');
  const { c } = useTheme();
  const { profile, refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.username ?? '');
  const [education, setEducation] = useState('');
  const [goal, setGoal] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [dailyMinutes, setDailyMinutes] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  /** Nunca alerta: o onboarding não pode ter uma porta de saída modal (§5.14). */
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    track('onboarding_started');
  }, []);

  const canContinue = () => {
    if (step === 0) return name.trim().length >= 2;
    if (step === 1) return !!education;
    if (step === 2) return !!goal;
    if (step === 3) return subjects.length > 0;
    return true;
  };

  const handleNext = () => {
    track('onboarding_step_completed', { step, total: TOTAL_STEPS });
    if (step < TOTAL_STEPS - 1) { setStep(step + 1); return; }
    handleComplete();
  };

  const handleComplete = async () => {
    setSubmitting(true);
    setFailed(false);
    try {
      await api.post('/onboarding', {
        username: name.trim(),
        education_level: education,
        study_goal: goal,
        daily_goal_minutes: dailyMinutes,
        subjects,
      });
      completed.current = true;
      track('onboarding_completed', {
        education_level: education,
        study_goal: goal,
        subjects_count: subjects.length,
      });
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (err) {
      console.error('[Onboarding]', err);
      setFailed(true);
      setSubmitting(false);
    }
  };

  // Fires on unmount unless the flow completed — that's the drop-off signal.
  const completed = useRef(false);
  useEffect(() => () => {
    if (!completed.current) track('onboarding_abandoned', { step: stepRef.current });
  }, []);
  const stepRef = useRef(step);
  stepRef.current = step;

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  /** Level and goal share a layout — one renderer, two datasets. */
  const renderChoices = (
    options: { id: string; icon: typeof BookOpen }[],
    selectedId: string,
    onSelect: (id: string) => void,
    table: 'education' | 'goals',
  ) => (
    <View style={{ gap: space.md }}>
      {options.map((opt) => {
        const selected = selectedId === opt.id;
        return (
          <Press
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            style={[
              styles.optionCard,
              {
                backgroundColor: selected ? c.accentSoft : c.surface,
                borderColor: selected ? c.accent : c.border,
              },
            ]}
          >
            <View style={[styles.optionIcon, { backgroundColor: c.surfaceRaised }]}>
              <opt.icon size={20} color={selected ? c.accent : c.fgMuted} strokeWidth={2.2} />
            </View>
            <Text style={{ ...t.bodyStrong, color: c.fg, flex: 1 }}>
              {tr(`${table}.${opt.id}`)}
            </Text>
            {selected && (
              <Animated.View entering={FadeIn} style={[styles.check, { backgroundColor: c.accent }]}>
                <Check size={13} color={c.fgOnAccent} strokeWidth={3} />
              </Animated.View>
            )}
          </Press>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: c.surfacePressed }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: c.accent }]} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 0 — name */}
          {step === 0 && (
            <Animated.View entering={FadeInDown.duration(320)} style={styles.step}>
              <View style={styles.mascot}><MascotBlock state={STEP_MASCOTS[0]} size={132} /></View>
              <Text style={{ ...t.title2, color: c.fg }}>{tr('welcomeTitle')}</Text>
              <Text style={{ ...t.body, color: c.fgMuted, marginTop: space.sm }}>
                {tr('nameSub')}
              </Text>
              <TextInput
                style={[
                  styles.nameInput,
                  { ...t.title3, backgroundColor: c.surface, color: c.fg, borderColor: c.border },
                ]}
                value={name}
                onChangeText={setName}
                placeholder={tr('namePlaceholder')}
                placeholderTextColor={c.fgSubtle}
                autoFocus
                maxLength={30}
              />
            </Animated.View>
          )}

          {/* 1 — level */}
          {step === 1 && (
            <Animated.View entering={FadeInDown.duration(320)} style={styles.step}>
              <View style={styles.mascot}><MascotBlock state={STEP_MASCOTS[1]} size={132} /></View>
              <Text style={{ ...t.title2, color: c.fg }}>{tr('levelTitle')}</Text>
              <Text style={{ ...t.body, color: c.fgMuted, marginTop: space.sm, marginBottom: space.xl }}>
                {tr('levelSub')}
              </Text>
              {renderChoices(EDUCATION_OPTIONS, education, setEducation, 'education')}
            </Animated.View>
          )}

          {/* 2 — goal */}
          {step === 2 && (
            <Animated.View entering={FadeInDown.duration(320)} style={styles.step}>
              <View style={styles.mascot}><MascotBlock state={STEP_MASCOTS[2]} size={132} /></View>
              <Text style={{ ...t.title2, color: c.fg }}>{tr('goalTitle')}</Text>
              <Text style={{ ...t.body, color: c.fgMuted, marginTop: space.sm, marginBottom: space.xl }}>
                {tr('goalSub')}
              </Text>
              {renderChoices(GOAL_OPTIONS, goal, setGoal, 'goals')}
            </Animated.View>
          )}

          {/* 3 — subjects */}
          {step === 3 && (
            <Animated.View entering={FadeInDown.duration(320)} style={styles.step}>
              <View style={styles.mascot}><MascotBlock state={STEP_MASCOTS[3]} size={132} /></View>
              <Text style={{ ...t.title2, color: c.fg }}>{tr('subjectsTitle')}</Text>
              <Text style={{ ...t.body, color: c.fgMuted, marginTop: space.sm, marginBottom: space.xl }}>
                {tr('subjectsSub')}
              </Text>
              <View style={styles.chips}>
                {SUBJECT_KEYS.map((key, i) => {
                  const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                  const selected = subjects.includes(key);
                  return (
                    <Press
                      key={key}
                      scale={0.94}
                      onPress={() =>
                        setSubjects((prev) =>
                          prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
                        )
                      }
                      style={[
                        styles.chip,
                        {
                          backgroundColor: c.surface,
                          borderColor: selected ? color : c.border,
                        },
                      ]}
                    >
                      <View style={[styles.chipDot, { backgroundColor: color }]} />
                      <Text style={{ ...t.label, color: selected ? c.fg : c.fgMuted }}>
                        {tr(`subjects.${key}`)}
                      </Text>
                    </Press>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* 4 — daily goal */}
          {step === 4 && (
            <Animated.View entering={FadeInDown.duration(320)} style={styles.step}>
              <View style={styles.mascot}><MascotBlock state={STEP_MASCOTS[4]} size={132} /></View>
              <Text style={{ ...t.title2, color: c.fg }}>{tr('dailyGoalTitle')}</Text>
              <Text style={{ ...t.body, color: c.fgMuted, marginTop: space.sm, marginBottom: space.xl }}>
                {tr('dailyGoalSub')}
              </Text>
              <View style={styles.timeGrid}>
                {TIME_OPTIONS.map((opt) => {
                  const selected = dailyMinutes === opt.minutes;
                  return (
                    <Press
                      key={opt.minutes}
                      scale={0.96}
                      onPress={() => setDailyMinutes(opt.minutes)}
                      style={[
                        styles.timeCard,
                        {
                          backgroundColor: selected ? c.accent : c.surface,
                          borderColor: selected ? c.accent : c.border,
                        },
                      ]}
                    >
                      <opt.icon size={22} color={selected ? c.fgOnAccent : c.fgMuted} strokeWidth={2.2} />
                      <Text
                        style={{
                          ...t.title3,
                          color: selected ? c.fgOnAccent : c.fg,
                          marginTop: space.sm,
                        }}
                      >
                        {opt.minutes} min
                      </Text>
                      <Text
                        style={{
                          ...t.caption,
                          color: selected ? c.fgOnAccent : c.fgSubtle,
                          opacity: selected ? 0.75 : 1,
                        }}
                      >
                        {tr(`time.${opt.minutes}`)}
                      </Text>
                    </Press>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </ScrollView>

        <View style={[styles.bottom, { backgroundColor: c.bg }]}>
          {failed && (
            <Text style={{ ...t.caption, color: c.danger, marginBottom: space.sm, textAlign: 'center' }}>
              {tr('saveFailed')}
            </Text>
          )}
          <Press
            haptic="medium"
            scale={0.985}
            onPress={handleNext}
            disabled={!canContinue() || submitting}
            style={[
              styles.cta,
              { backgroundColor: c.accent, opacity: !canContinue() || submitting ? 0.35 : 1 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={c.fgOnAccent} />
            ) : (
              <>
                <Text style={{ ...t.bodyStrong, color: c.fgOnAccent }}>
                  {step === TOTAL_STEPS - 1 ? tr('start') : tr('continue')}
                </Text>
                <ChevronRight size={19} color={c.fgOnAccent} strokeWidth={2.4} />
              </>
            )}
          </Press>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  progressWrap: { paddingHorizontal: space.lg, paddingTop: space.sm },
  progressTrack: { height: 3, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full },

  scroll: { flexGrow: 1, paddingHorizontal: space.lg, paddingBottom: 120 },
  step: { paddingTop: space.xxl },
  /** Um coelho por passo, sempre 132, com 24 de respiro abaixo (§3.3). */
  mascot: { marginBottom: space.xl },


  nameInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    marginTop: space.xl,
  },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 64,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  timeCard: {
    width: (W - space.lg * 2 - space.md) / 2,
    paddingVertical: space.xl,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },

  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.lg,
    paddingBottom: 36,
    paddingTop: space.lg,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 54,
    borderRadius: radius.lg,
  },
});
