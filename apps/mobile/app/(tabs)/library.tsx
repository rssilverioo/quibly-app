import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { BookOpen, HelpCircle, Trash2, Plus } from 'lucide-react-native';
import type { FlashcardSet, Quiz } from '@quibly/shared';

import { listFlashcardSets, deleteFlashcardSet } from '../../services/flashcards';
import { listQuizzes, deleteQuiz } from '../../services/quizzes';
import EmptyState from '../../components/common/EmptyState';
import Press from '../../components/ui/Press';
import { Mascot } from '../../components/mascot';
import { useTheme, text as t, space, radius } from '../../theme';
import { TAB_BAR_CLEARANCE } from './_layout';

type Tab = 'flashcards' | 'quizzes';

export default function LibraryScreen() {
  const router = useRouter();
  const { t: tr } = useTranslation('library');
  const { c } = useTheme();

  const [activeTab, setActiveTab] = useState<Tab>('flashcards');
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const [sets, quizList] = await Promise.allSettled([listFlashcardSets(), listQuizzes()]);
    if (sets.status === 'fulfilled') setFlashcardSets(sets.value ?? []);
    if (quizList.status === 'fulfilled') setQuizzes(quizList.value ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));
  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  /** Material is derived from a lesson now — creating it starts with a capture. */
  const goCapture = () => router.push('/lesson/capture');

  const confirmDelete = (kind: Tab, id: string) => {
    const ns = kind === 'flashcards' ? 'flashcards' : 'quizzes';
    Alert.alert(tr(`${ns}:deleteConfirm`), tr(`${ns}:deleteMessage`), [
      { text: tr('common:cancel'), style: 'cancel' },
      {
        text: tr('common:delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            if (kind === 'flashcards') {
              await deleteFlashcardSet(id);
              setFlashcardSets((prev) => prev.filter((s) => s.id !== id));
            } else {
              await deleteQuiz(id);
              setQuizzes((prev) => prev.filter((q) => q.id !== id));
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } catch {}
        },
      },
    ]);
  };

  const renderItem = (kind: Tab) => ({ item, index }: { item: any; index: number }) => {
    const Icon = kind === 'flashcards' ? BookOpen : HelpCircle;
    const meta =
      kind === 'flashcards'
        ? tr('cards', { count: item._count?.flashcards ?? 0 })
        : `${tr('questions', { count: item._count?.questions ?? item.total_q })}` +
          (item.score != null
            ? ` · ${tr('score', { score: Math.round((item.score / item.total_q) * 100) })}`
            : ` · ${tr('notAttempted')}`);

    return (
      <Animated.View entering={FadeInDown.duration(280).delay(Math.min(index, 8) * 35)}>
        <Press
          scale={0.98}
          onPress={() => router.push(kind === 'flashcards' ? `/flashcards/${item.id}` : `/quizzes/${item.id}`)}
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <View style={[styles.cardIcon, { backgroundColor: c.surfaceRaised }]}>
            <Icon size={17} color={c.fgMuted} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ ...t.bodyStrong, color: c.fg }}>{item.title}</Text>
            <Text style={{ ...t.caption, color: c.fgSubtle, marginTop: 3 }}>{meta}</Text>
          </View>
          <Press
            haptic="light"
            scale={0.85}
            onPress={() => confirmDelete(kind, item.id)}
            style={styles.deleteBtn}
          >
            <Trash2 size={17} color={c.fgSubtle} />
          </Press>
        </Press>
      </Animated.View>
    );
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'flashcards', label: tr('flashcards') },
    { key: 'quizzes', label: tr('quizzes') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={{ ...t.title2, color: c.fg }}>{tr('title')}</Text>
          <Press
            haptic="medium"
            scale={0.94}
            onPress={goCapture}
            style={[styles.createBtn, { backgroundColor: c.accent }]}
          >
            <Plus size={15} color={c.fgOnAccent} strokeWidth={2.6} />
            <Text style={{ ...t.caption, color: c.fgOnAccent }}>{tr('create')}</Text>
          </Press>
        </View>

        <View style={[styles.segmented, { backgroundColor: c.surface, borderColor: c.border }]}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Press
                key={tab.key}
                haptic="light"
                scale={0.97}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.segmentBtn, active && { backgroundColor: c.surfaceRaised }]}
              >
                <Text style={{ ...t.label, color: active ? c.fg : c.fgSubtle }}>{tab.label}</Text>
              </Press>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
        ) : (
          <FlatList
            key={activeTab}
            data={activeTab === 'flashcards' ? flashcardSets : quizzes}
            keyExtractor={(item) => item.id}
            renderItem={renderItem(activeTab)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.fgMuted} />
            }
            ListEmptyComponent={
              <EmptyState
                icon={<Mascot state={activeTab === 'flashcards' ? 'reading' : 'searching'} size={132} />}
                title={tr(activeTab === 'flashcards' ? 'noFlashcards' : 'noQuizzes')}
                message={tr(activeTab === 'flashcards' ? 'noFlashcardsMessage' : 'noQuizzesMessage')}
                ctaLabel={tr('create')}
                onCta={goCapture}
              />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.full,
  },

  segmented: {
    flexDirection: 'row',
    marginHorizontal: space.xl,
    marginBottom: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
  },
  segmentBtn: { flex: 1, paddingVertical: space.md, alignItems: 'center', borderRadius: radius.sm },

  listContent: { paddingHorizontal: space.xl, paddingBottom: TAB_BAR_CLEARANCE, gap: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: { padding: space.sm },
});
