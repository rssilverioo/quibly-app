import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Plus, Mic, FileText, Camera, Flame, AlertCircle, BookOpen, HelpCircle, ChevronRight,
} from 'lucide-react-native';

import { useAuth } from '../../contexts/AuthContext';
import { listLessons, type LessonSummary } from '../../services/lessons';
import { getLiveMembers, type LiveMember } from '../../services/leagues';

import StreakCalendarModal from '../../components/StreakCalendarModal';
import Press from '../../components/ui/Press';
import Glass from '../../components/ui/Glass';
import LiveDot from '../../components/ui/LiveDot';
import Avatar from '../../components/ui/Avatar';
import { MascotBlock } from '../../components/mascot';
import { useTheme, text as t, space, radius } from '../../theme';
import { TAB_BAR_CLEARANCE } from './_layout';

const SOURCE_ICON = { audio: Mic, document: FileText, photo: Camera } as const;

/**
 * Shown in place of the empty state. Each mode gets its own hue so the first
 * screen isn't monochrome — colour here is content, not decoration.
 */
const CAPTURE_MODES = [
  { key: 'record', Icon: Mic, tint: '#C8FF4D', titleKey: 'modeRecord', subKey: 'modeRecordSub' },
  { key: 'pdf', Icon: FileText, tint: '#38BDF8', titleKey: 'modePdf', subKey: 'modePdfSub' },
  { key: 'photo', Icon: Camera, tint: '#F472B6', titleKey: 'modePhoto', subKey: 'modePhotoSub' },
] as const;

function relativeDay(iso: string, locale: string): string {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return locale.startsWith('pt') ? 'Hoje' : 'Today';
  if (days === 1) return locale.startsWith('pt') ? 'Ontem' : 'Yesterday';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export default function LessonsScreen() {
  const router = useRouter();
  const { t: tr, i18n } = useTranslation('lessons');
  const { c } = useTheme();
  const { user, profile, refreshProfile } = useAuth();

  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [live, setLive] = useState<LiveMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStreak, setShowStreak] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [lessonList, liveMembers] = await Promise.allSettled([
      listLessons(),
      getLiveMembers(),
    ]);
    if (lessonList.status === 'fulfilled') setLessons(lessonList.value ?? []);
    if (liveMembers.status === 'fulfilled') setLive(liveMembers.value ?? []);
  }, [user]);

  const hasLoaded = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!hasLoaded.current) setLoading(true);
        await Promise.allSettled([fetchData(), refreshProfile()]);
        if (!cancelled) { setLoading(false); hasLoaded.current = true; }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([fetchData(), refreshProfile()]);
    setRefreshing(false);
  }, [fetchData, refreshProfile]);

  const streak = profile?.current_streak ?? 0;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.fgMuted} />
          }
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
            <Text style={{ ...t.title2, color: c.fg }}>{tr('tabTitle')}</Text>
            <Press
              haptic="light"
              scale={0.94}
              onPress={() => setShowStreak(true)}
              style={[styles.streakChip, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <Flame size={13} color={streak > 0 ? c.warning : c.fgSubtle} strokeWidth={2.4} />
              <Text style={{ ...t.caption, color: streak > 0 ? c.fg : c.fgSubtle }}>{streak}</Text>
            </Press>
          </Animated.View>

          {/* Social, kept to one line: who's studying right now */}
          {live.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(40)}>
              <Press
                scale={0.98}
                onPress={() => router.push(`/league/${live[0].league_id}`)}
                style={[styles.liveStrip, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <LiveDot size={6} />
                <View style={styles.liveAvatars}>
                  {live.slice(0, 4).map((member, i) => (
                    <View key={member.session_id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                      <Avatar
                        uri={member.avatar_url}
                        name={member.display_name}
                        size={26}
                        ringColor={c.surface}
                      />
                    </View>
                  ))}
                </View>
                <Text style={{ ...t.caption, color: c.fgMuted, flex: 1 }}>
                  {live.length === 1
                    ? `${live[0].display_name} · ${live[0].subject_name}`
                    : tr('studyingNow', { count: live.length })}
                </Text>
              </Press>
            </Animated.View>
          )}

          {/* The one primary action */}
          <Animated.View entering={FadeInDown.duration(300).delay(80)}>
            <Press
              haptic="medium"
              scale={0.985}
              onPress={() => router.push('/lesson/capture')}
              style={[styles.cta, { backgroundColor: c.accent }]}
            >
              <Plus size={19} color={c.fgOnAccent} strokeWidth={2.6} />
              <Text style={{ ...t.bodyStrong, color: c.fgOnAccent }}>{tr('capture')}</Text>
            </Press>
          </Animated.View>

          {/* Lessons */}
          {lessons.length === 0 ? (
            /* The empty state does the teaching: the three capture modes as
             * real, tappable cards. A paragraph in a void taught nothing and
             * still cost the user a tap to find out what the app does. */
            <View style={styles.empty}>
              <Animated.View entering={FadeInDown.duration(300).delay(120)}>
                <MascotBlock state="wave" size={148} />
              </Animated.View>

              <Animated.View entering={FadeInDown.duration(300).delay(140)}>
                <Text style={{ ...t.overline, color: c.fgSubtle, marginBottom: space.md }}>
                  {tr('howItWorks')}
                </Text>
              </Animated.View>

              {CAPTURE_MODES.map((mode, i) => (
                <Animated.View
                  key={mode.key}
                  entering={FadeInDown.duration(300).delay(160 + i * 60)}
                >
                  <Press haptic="medium" scale={0.97} onPress={() => router.push('/lesson/capture')}>
                    <Glass variant="surface" interactive style={[styles.modeCard, { borderColor: c.border }]}>
                    <View style={[styles.modeIcon, { backgroundColor: mode.tint + '22' }]}>
                      <mode.Icon size={19} color={mode.tint} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...t.bodyStrong, color: c.fg }}>{tr(mode.titleKey)}</Text>
                      <Text style={{ ...t.caption, color: c.fgMuted, marginTop: 3 }}>
                        {tr(mode.subKey)}
                      </Text>
                    </View>
                      <ChevronRight size={17} color={c.fgSubtle} />
                    </Glass>
                  </Press>
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={styles.list}>
              {lessons.map((lesson, i) => {
                const Icon = SOURCE_ICON[lesson.source];
                const isProcessing = lesson.status === 'processing';
                const isFailed = lesson.status === 'failed';
                const derived = lesson._count.flashcard_sets + lesson._count.quizzes;

                return (
                  <Animated.View
                    key={lesson.id}
                    entering={FadeInDown.duration(300).delay(120 + Math.min(i, 6) * 40)}
                  >
                    <Press scale={0.98} onPress={() => router.push(`/lesson/${lesson.id}`)}>
                      <Glass variant="surface" style={[styles.card, { borderColor: c.border }]}>
                      <View style={styles.cardTop}>
                        <View style={[styles.cardIcon, { backgroundColor: c.surfaceRaised }]}>
                          {isFailed ? (
                            <AlertCircle size={15} color={c.danger} strokeWidth={2.2} />
                          ) : (
                            <Icon size={15} color={c.fgMuted} strokeWidth={2.2} />
                          )}
                        </View>
                        <Text style={{ ...t.caption, color: c.fgSubtle }}>
                          {relativeDay(lesson.created_at, i18n.language)}
                        </Text>
                      </View>

                      <Text numberOfLines={2} style={{ ...t.bodyStrong, color: c.fg, marginTop: space.md }}>
                        {isProcessing ? tr('statusProcessing') : lesson.title}
                      </Text>

                      {isProcessing ? (
                        <Text style={{ ...t.caption, color: c.fgSubtle, marginTop: 4 }}>
                          {tr('statusProcessingSub')}
                        </Text>
                      ) : (
                        !!lesson.summary && (
                          <Text numberOfLines={2} style={{ ...t.caption, color: c.fgMuted, marginTop: 4 }}>
                            {lesson.summary}
                          </Text>
                        )
                      )}

                      {derived > 0 && (
                        <View style={styles.cardMeta}>
                          {lesson._count.flashcard_sets > 0 && (
                            <View style={styles.metaItem}>
                              <BookOpen size={12} color={c.fgSubtle} />
                              <Text style={{ ...t.caption, color: c.fgSubtle }}>
                                {lesson._count.flashcard_sets}
                              </Text>
                            </View>
                          )}
                          {lesson._count.quizzes > 0 && (
                            <View style={styles.metaItem}>
                              <HelpCircle size={12} color={c.fgSubtle} />
                              <Text style={{ ...t.caption, color: c.fgSubtle }}>
                                {lesson._count.quizzes}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                      </Glass>
                    </Press>
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Clears the absolute, glass tab bar. */}
          <View style={{ height: TAB_BAR_CLEARANCE }} />
        </ScrollView>
      </SafeAreaView>

      <StreakCalendarModal
        visible={showStreak}
        onClose={() => setShowStreak(false)}
        currentStreak={streak}
        longestStreak={profile?.longest_streak ?? 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: space.xl, paddingTop: space.sm },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },

  liveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: space.md,
  },
  liveAvatars: { flexDirection: 'row', alignItems: 'center' },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 18,
    borderRadius: radius.lg,
  },

  empty: { marginTop: space.xxl, gap: space.md },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: { gap: space.md, marginTop: space.xl },
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
