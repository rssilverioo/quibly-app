import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Play, ChevronRight, Layers } from 'lucide-react-native';
import type { FlashcardSet } from '@quibly/shared';

import { useAuth } from '../../contexts/AuthContext';
import { useSessionStore } from '../../stores/session.store';
import { listFlashcardSets } from '../../services/flashcards';
import Press from '../../components/ui/Press';
import { useTheme, text as t, space, radius } from '../../theme';
import { TAB_BAR_CLEARANCE } from './_layout';

export default function StudyScreen() {
  const router = useRouter();
  const { t: tr } = useTranslation('home');
  const { c } = useTheme();
  const { profile } = useAuth();
  const { isPaused, subjectName: pausedSubjectName } = useSessionStore();

  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);

  const hasLoaded = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const sets = await listFlashcardSets();
          if (!cancelled) setFlashcardSets(sets ?? []);
        } catch {}
        if (!cancelled) hasLoaded.current = true;
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const totalMinutes = profile?.total_study_minutes ?? 0;
  const totalHours = Math.floor(totalMinutes / 60);

  const stats = [
    { value: `${totalHours}h`, label: tr('totalHours') },
    { value: String(Math.ceil(totalMinutes / 25)), label: tr('streakCalendar.daysStudied') },
    { value: String(profile?.current_streak ?? 0), label: tr('dayStreak', { count: profile?.current_streak ?? 0 }) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(300)}>
            <Text style={{ ...t.title2, color: c.fg }}>{tr('startStudying')}</Text>
          </Animated.View>

          {/* Total time is the hero — it's the number people come back for. */}
          <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.hero}>
            <Text style={{ ...t.overline, color: c.fgSubtle }}>{tr('totalHours')}</Text>
            <View style={styles.heroRow}>
              <Text style={{ ...t.display, color: c.fg }}>{totalHours}</Text>
              <Text style={{ ...t.title3, color: c.fgMuted, marginBottom: 10 }}>h</Text>
            </View>
          </Animated.View>

          {/* Resume takes priority over starting fresh */}
          {isPaused && (
            <Animated.View entering={FadeInDown.duration(300).delay(80)}>
              <Press
                haptic="medium"
                scale={0.985}
                onPress={() => router.push('/session/active')}
                style={[styles.resumeCard, { backgroundColor: c.surface, borderColor: c.warning }]}
              >
                <View style={[styles.pausedDot, { backgroundColor: c.warning }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...t.bodyStrong, color: c.fg }}>{tr('sessionPaused')}</Text>
                  {!!pausedSubjectName && (
                    <Text style={{ ...t.caption, color: c.fgSubtle, marginTop: 2 }}>
                      {pausedSubjectName}
                    </Text>
                  )}
                </View>
                <Text style={{ ...t.label, color: c.warning }}>{tr('resume')}</Text>
              </Press>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(300).delay(110)}>
            <Press
              haptic="medium"
              scale={0.985}
              onPress={() => router.push('/session/setup')}
              style={[styles.cta, { backgroundColor: c.accent }]}
            >
              <Play size={19} color={c.fgOnAccent} fill={c.fgOnAccent} />
              <Text style={{ ...t.bodyStrong, color: c.fgOnAccent }}>
                {tr('startStudyingSubtitle')}
              </Text>
            </Press>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(300).delay(150)} style={styles.statsRow}>
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <Text style={{ ...t.title3, color: c.fg }}>{stat.value}</Text>
                <Text numberOfLines={1} style={{ ...t.caption, color: c.fgSubtle, marginTop: 2 }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </Animated.View>

          {flashcardSets.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(190)} style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={{ ...t.overline, color: c.fgSubtle }}>{tr('continueStudying')}</Text>
                <Press haptic={false} scale={0.94} onPress={() => router.push('/(tabs)/library')}>
                  <Text style={{ ...t.caption, color: c.fgMuted }}>{tr('seeAll')}</Text>
                </Press>
              </View>

              <View style={{ gap: space.sm }}>
                {flashcardSets.slice(0, 5).map((set) => (
                  <Press
                    key={set.id}
                    scale={0.98}
                    onPress={() => router.push(`/flashcards/${set.id}`)}
                    style={[styles.deckRow, { backgroundColor: c.surface, borderColor: c.border }]}
                  >
                    <View style={[styles.deckIcon, { backgroundColor: c.surfaceRaised }]}>
                      <Layers size={15} color={c.fgMuted} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ ...t.bodyStrong, color: c.fg }}>
                        {set.title}
                      </Text>
                      <Text style={{ ...t.caption, color: c.fgSubtle, marginTop: 2 }}>
                        {set._count?.flashcards ?? 0}
                      </Text>
                    </View>
                    <ChevronRight size={17} color={c.fgSubtle} />
                  </Press>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Clears the absolute, glass tab bar. */}
          <View style={{ height: TAB_BAR_CLEARANCE }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.xl, paddingTop: space.md },

  hero: { marginTop: space.xl, marginBottom: space.xl },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.sm },

  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: space.md,
  },
  pausedDot: { width: 8, height: 8, borderRadius: 4 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 18,
    borderRadius: radius.lg,
  },

  statsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  statCard: {
    flex: 1,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },

  section: { marginTop: space.xxl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },

  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  deckIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
