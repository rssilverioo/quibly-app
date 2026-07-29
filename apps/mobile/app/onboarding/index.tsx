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
                backgroundColor: c.surface,
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
          <View style={[styles.progressTrack, { backgroundColor: c.surface }]}>
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
              <MascotBlock state="wave" size={132} />
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
                          color: selected ? 'rgba(10,10,12,0.6)' : c.fgSubtle,
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
  progressWrap: { paddingHorizontal: space.xl, paddingTop: space.sm },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  scroll: { flexGrow: 1, paddingHorizontal: space.xl, paddingBottom: 120 },
  step: { paddingTop: space.xxxl },


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
    padding: space.lg,
    borderRadius: radius.lg,
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
    width: (W - space.xl * 2 - space.md) / 2,
    paddingVertical: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },

  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.xl,
    paddingBottom: 36,
    paddingTop: space.lg,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 18,
    borderRadius: radius.lg,
  },
});
