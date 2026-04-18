import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@quibly/shared/constants';
import { BookOpen, HelpCircle, Trash2, Plus } from 'lucide-react-native';
import type { FlashcardSet, Quiz } from '@quibly/shared';
import { listFlashcardSets, deleteFlashcardSet } from '../../services/flashcards';
import { listQuizzes, deleteQuiz } from '../../services/quizzes';
import EmptyState from '../../components/common/EmptyState';

type Tab = 'flashcards' | 'quizzes';

export default function LibraryScreen() {
  const router = useRouter();
  const { t } = useTranslation('library');
  const [activeTab, setActiveTab] = useState<Tab>('flashcards');
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sets, quizList] = await Promise.allSettled([listFlashcardSets(), listQuizzes()]);
      if (sets.status === 'fulfilled') setFlashcardSets(sets.value ?? []);
      if (quizList.status === 'fulfilled') setQuizzes(quizList.value ?? []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));
  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const handleDeleteFlashcard = (id: string) => {
    Alert.alert(t('flashcards:deleteConfirm'), t('flashcards:deleteMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('common:delete'), style: 'destructive', onPress: async () => {
        try {
          await deleteFlashcardSet(id);
          setFlashcardSets((prev) => prev.filter((s) => s.id !== id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }},
    ]);
  };

  const handleDeleteQuiz = (id: string) => {
    Alert.alert(t('quizzes:deleteConfirm'), t('quizzes:deleteMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('common:delete'), style: 'destructive', onPress: async () => {
        try {
          await deleteQuiz(id);
          setQuizzes((prev) => prev.filter((q) => q.id !== id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }},
    ]);
  };

  const renderFlashcardItem = ({ item }: { item: FlashcardSet }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push(`/flashcards/${item.id}`)}>
      <View style={styles.cardContent}>
        <View style={[styles.cardIcon, { backgroundColor: '#DBEAFE' }]}>
          <BookOpen size={20} color="#1E40AF" />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardMeta}>{t('cards', { count: item._count?.flashcards ?? 0 })}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteFlashcard(item.id)} style={styles.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Trash2 size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderQuizItem = ({ item }: { item: Quiz }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push(`/quizzes/${item.id}`)}>
      <View style={styles.cardContent}>
        <View style={[styles.cardIcon, { backgroundColor: '#FEE2E2' }]}>
          <HelpCircle size={20} color="#DC2626" />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardMeta}>
            {t('questions', { count: item._count?.questions ?? item.total_q })}
            {item.score != null ? ` · ${t('score', { score: Math.round((item.score / item.total_q) * 100) })}` : ` · ${t('notAttempted')}`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteQuiz(item.id)} style={styles.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Trash2 size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('title')}</Text>
        <TouchableOpacity style={styles.createBtn} activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/upload', params: { type: activeTab === 'flashcards' ? 'flashcards' : 'quiz' } })}>
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.createBtnText}>{t('create')}</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'flashcards' && styles.segmentActive]}
          onPress={() => setActiveTab('flashcards')}
        >
          <Text style={[styles.segmentText, activeTab === 'flashcards' && styles.segmentTextActive]}>{t('flashcards')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'quizzes' && styles.segmentActive]}
          onPress={() => setActiveTab('quizzes')}
        >
          <Text style={[styles.segmentText, activeTab === 'quizzes' && styles.segmentTextActive]}>{t('quizzes')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>
      ) : activeTab === 'flashcards' ? (
        <FlatList
          data={flashcardSets}
          keyExtractor={(item) => item.id}
          renderItem={renderFlashcardItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
          ListEmptyComponent={
            <EmptyState
              icon={<BookOpen size={48} color="#1E40AF" />}
              title={t('noFlashcards')}
              message={t('noFlashcardsMessage')}
              ctaLabel={t('create')}
              onCta={() => router.push({ pathname: '/upload', params: { type: 'flashcards' } })}
            />
          }
        />
      ) : (
        <FlatList
          data={quizzes}
          keyExtractor={(item) => item.id}
          renderItem={renderQuizItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
          ListEmptyComponent={
            <EmptyState
              icon={<HelpCircle size={48} color="#1E40AF" />}
              title={t('noQuizzes')}
              message={t('noQuizzesMessage')}
              ctaLabel={t('create')}
              onCta={() => router.push({ pathname: '/upload', params: { type: 'quiz' } })}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EEF5FF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontFamily: FONTS.bold, color: '#1A2E4A' },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E40AF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  createBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#FFFFFF' },

  segmented: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  segmentActive: { backgroundColor: '#1E40AF' },
  segmentText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#8BA3BC' },
  segmentTextActive: { color: '#FFFFFF' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#1A2E4A', marginBottom: 4 },
  cardMeta: { fontSize: 12, fontFamily: FONTS.medium, color: '#8BA3BC' },
  deleteBtn: { padding: 8 },
});
