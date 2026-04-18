import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FONTS } from '@quibly/shared/constants';
import { Timer, Headphones, ChevronRight, Clock, BookOpen } from 'lucide-react-native';
import type { FlashcardSet } from '@quibly/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionStore } from '../../stores/session.store';
import { listFlashcardSets } from '../../services/flashcards';

const { width: SW } = Dimensions.get('window');

export default function StudyScreen() {
  const router = useRouter();
  const { t } = useTranslation('home');
  const { profile } = useAuth();
  const { isPaused, subjectName: pausedSubjectName } = useSessionStore();

  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);

  const hasLoaded = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!hasLoaded.current) setLoading(true);
        try {
          const sets = await listFlashcardSets();
          if (!cancelled) setFlashcardSets(sets ?? []);
        } catch {}
        if (!cancelled) { setLoading(false); hasLoaded.current = true; }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const totalHours = profile ? Math.floor(profile.total_study_minutes / 60) : 0;
  const totalSessions = profile?.total_study_minutes ? Math.ceil(profile.total_study_minutes / 25) : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Study</Text>

        {/* Paused session */}
        {isPaused && (
          <TouchableOpacity style={styles.pausedCard} activeOpacity={0.85} onPress={() => router.push('/session/active')}>
            <View style={styles.pausedDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pausedTitle}>{t('sessionPaused')}</Text>
              {pausedSubjectName && <Text style={styles.pausedSub}>{pausedSubjectName}</Text>}
            </View>
            <View style={styles.resumeBtn}><Text style={styles.resumeText}>{t('resume')}</Text></View>
          </TouchableOpacity>
        )}

        {/* Main actions */}
        <TouchableOpacity style={styles.mainCard} activeOpacity={0.85} onPress={() => router.push('/session/setup')}>
          <View style={[styles.mainIcon, { backgroundColor: '#1E40AF' }]}>
            <Timer size={28} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mainTitle}>{t('startStudying')}</Text>
            <Text style={styles.mainSub}>{t('startStudyingSubtitle')}</Text>
          </View>
          <ChevronRight size={22} color="#8BA3BC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.mainCard} activeOpacity={0.85}
          onPress={() => {
            if (flashcardSets.length > 0) {
              router.push(`/flashcards/${flashcardSets[0].id}`);
            } else {
              router.push('/upload');
            }
          }}>
          <View style={[styles.mainIcon, { backgroundColor: '#D97706' }]}>
            <Headphones size={28} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mainTitle}>Audio Study</Text>
            <Text style={styles.mainSub}>Listen & learn hands-free</Text>
          </View>
          <ChevronRight size={22} color="#8BA3BC" />
        </TouchableOpacity>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#DBEAFE' }]}>
              <Clock size={18} color="#1E40AF" />
            </View>
            <Text style={styles.statValue}>{totalHours}h</Text>
            <Text style={styles.statLabel}>Total study</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
              <BookOpen size={18} color="#059669" />
            </View>
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
              <Timer size={18} color="#D97706" />
            </View>
            <Text style={styles.statValue}>{profile?.current_streak ?? 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>

        {/* Recent decks for quick audio */}
        {flashcardSets.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Quick start audio</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {flashcardSets.slice(0, 6).map((set) => (
                <TouchableOpacity key={set.id} style={styles.deckCard} activeOpacity={0.85}
                  onPress={() => router.push(`/flashcards/${set.id}`)}>
                  <View style={styles.deckIcon}>
                    <Headphones size={16} color="#1E40AF" />
                  </View>
                  <Text style={styles.deckTitle} numberOfLines={2}>{set.title}</Text>
                  <Text style={styles.deckMeta}>{set._count?.flashcards ?? '?'} cards</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EEF5FF' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  title: { fontSize: 28, fontFamily: FONTS.bold, color: '#1A2E4A', marginBottom: 20, paddingTop: 8 },

  pausedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  pausedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F59E0B', marginRight: 12 },
  pausedTitle: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#1A2E4A' },
  pausedSub: { fontSize: 12, fontFamily: FONTS.regular, color: '#8BA3BC', marginTop: 2 },
  resumeBtn: { backgroundColor: '#10B981', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12 },
  resumeText: { fontSize: 13, fontFamily: FONTS.bold, color: '#FFFFFF' },

  mainCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  mainIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  mainTitle: { fontSize: 17, fontFamily: FONTS.bold, color: '#1A2E4A', marginBottom: 3 },
  mainSub: { fontSize: 13, fontFamily: FONTS.regular, color: '#8BA3BC' },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontFamily: FONTS.bold, color: '#1A2E4A', marginBottom: 2 },
  statLabel: { fontSize: 11, fontFamily: FONTS.medium, color: '#8BA3BC' },

  sectionTitle: { fontSize: 18, fontFamily: FONTS.bold, color: '#1A2E4A', marginBottom: 14 },
  hScroll: { paddingRight: 20, marginBottom: 8 },

  deckCard: { width: SW * 0.35, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  deckIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  deckTitle: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#1A2E4A', marginBottom: 4 },
  deckMeta: { fontSize: 11, fontFamily: FONTS.medium, color: '#8BA3BC' },
});
