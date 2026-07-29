import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Trash2, Mic, FileText, Camera, AlertCircle,
  BookOpen, HelpCircle, Send, ChevronDown, ChevronUp,
} from 'lucide-react-native';

import Press from '../../components/ui/Press';
import Glass from '../../components/ui/Glass';
import { Mascot } from '../../components/mascot';
import { useTheme, text as t, space, radius } from '../../theme';
import { track } from '../../lib/analytics';
import {
  getLesson, askLesson, deleteLesson,
  generateFlashcardsFromLesson, generateQuizFromLesson,
  type Lesson,
} from '../../services/lessons';

/** How often to re-check a lesson that's still being processed. */
const POLL_MS = 4000;

const SOURCE_ICON = { audio: Mic, document: FileText, photo: Camera } as const;

export default function LessonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t: tr } = useTranslation('lessons');
  const { c } = useTheme();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ answer: string; grounded: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  const [generating, setGenerating] = useState<'flashcards' | 'quiz' | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getLesson(id);
      setLesson(data);

      // lesson_ready / lesson_processing_failed are server-sourced (fired
      // from lessons.service.ts the moment processing actually finishes) —
      // the client only polls for the result, it doesn't get to say when
      // the AI loop closed.

      // Keep polling only while the server is still working on it.
      if (data.status === 'processing') {
        pollRef.current = setTimeout(load, POLL_MS);
      }
    } catch (err: any) {
      Alert.alert(tr('statusFailed'), err?.message ?? '');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [load]);

  const ask = async () => {
    const q = question.trim();
    if (!q || !id) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await askLesson(id, q);
      setAnswer(res);
      track('lesson_asked', { grounded: res.grounded });
      setQuestion('');
    } catch (err: any) {
      Alert.alert(tr('statusFailed'), err?.message ?? '');
    } finally {
      setAsking(false);
    }
  };

  const generate = async (kind: 'flashcards' | 'quiz') => {
    if (!id) return;
    setGenerating(kind);
    try {
      const result =
        kind === 'flashcards'
          ? await generateFlashcardsFromLesson(id)
          : await generateQuizFromLesson(id);
      track('material_generated', { kind });
      router.push(kind === 'flashcards' ? `/flashcards/${result.id}` : `/quizzes/${result.id}`);
      load();
    } catch (err: any) {
      Alert.alert(tr('statusFailed'), err?.message ?? '');
    } finally {
      setGenerating(null);
    }
  };

  const confirmDelete = () => {
    Alert.alert(tr('deleteConfirmTitle'), tr('deleteConfirmBody'), [
      { text: tr('common:cancel'), style: 'cancel' },
      {
        text: tr('delete'),
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          await deleteLesson(id).catch(() => {});
          track('lesson_deleted');
          router.back();
        },
      },
    ]);
  };

  if (loading || !lesson) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const SourceIcon = SOURCE_ICON[lesson.source];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header: floats over the scrolling note, so it earns the glass. */}
        <Glass variant="chrome" cornerRadius={0} style={styles.header}>
          <Press haptic={false} scale={0.9} onPress={() => router.back()} style={styles.iconBtn}>
            <ArrowLeft size={22} color={c.fgMuted} />
          </Press>
          <Press haptic="light" scale={0.9} onPress={confirmDelete} style={styles.iconBtn}>
            <Trash2 size={19} color={c.fgSubtle} />
          </Press>
        </Glass>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(320)}>
            <View style={styles.sourceRow}>
              <SourceIcon size={13} color={c.fgSubtle} strokeWidth={2.2} />
              <Text style={{ ...t.overline, color: c.fgSubtle }}>
                {tr(
                  lesson.source === 'audio'
                    ? 'sourceAudio'
                    : lesson.source === 'document'
                    ? 'sourceDocument'
                    : 'sourcePhoto',
                )}
              </Text>
            </View>
            <Text style={{ ...t.title2, color: c.fg, marginTop: space.sm }}>{lesson.title}</Text>
          </Animated.View>

          {/* Still working */}
          {lesson.status === 'processing' && (
            <Animated.View
              entering={FadeIn}
              style={[styles.stateCard, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <Mascot state="thinking" size={56} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...t.bodyStrong, color: c.fg }}>{tr('statusProcessing')}</Text>
                <Text style={{ ...t.caption, color: c.fgMuted, marginTop: 3 }}>
                  {tr('statusProcessingSub')}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Failed */}
          {lesson.status === 'failed' && (
            <View style={[styles.stateCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Mascot state="sad" size={56} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...t.bodyStrong, color: c.fg }}>{tr('statusFailed')}</Text>
                {!!lesson.error_message && (
                  <Text style={{ ...t.caption, color: c.fgMuted, marginTop: 3 }}>
                    {lesson.error_message}
                  </Text>
                )}
              </View>
            </View>
          )}

          {lesson.status === 'ready' && (
            <>
              {/* Summary */}
              {!!lesson.summary && (
                <Animated.View entering={FadeInDown.duration(320).delay(60)} style={styles.section}>
                  <Text style={{ ...t.overline, color: c.fgSubtle }}>{tr('summary')}</Text>
                  <Text style={{ ...t.body, color: c.fg, marginTop: space.md }}>
                    {lesson.summary}
                  </Text>
                </Animated.View>
              )}

              {/* Key points */}
              {lesson.key_points.length > 0 && (
                <Animated.View entering={FadeInDown.duration(320).delay(110)} style={styles.section}>
                  <Text style={{ ...t.overline, color: c.fgSubtle }}>{tr('keyPoints')}</Text>
                  <View style={{ gap: space.md, marginTop: space.md }}>
                    {lesson.key_points.map((point, i) => (
                      <Glass
                        key={`${point.term}-${i}`}
                        variant="surface"
                        style={[styles.pointCard, { borderColor: c.border }]}
                      >
                        <Text style={{ ...t.bodyStrong, color: c.fg }}>{point.term}</Text>
                        <Text style={{ ...t.label, color: c.fgMuted, marginTop: 4 }}>
                          {point.explanation}
                        </Text>
                      </Glass>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Open questions */}
              {lesson.open_questions.length > 0 && (
                <Animated.View entering={FadeInDown.duration(320).delay(160)} style={styles.section}>
                  <Text style={{ ...t.overline, color: c.warning }}>{tr('openQuestions')}</Text>
                  <View style={{ gap: space.sm, marginTop: space.md }}>
                    {lesson.open_questions.map((q, i) => (
                      <View key={i} style={styles.openRow}>
                        <View style={[styles.bullet, { backgroundColor: c.warning }]} />
                        <Text style={{ ...t.label, color: c.fgMuted, flex: 1 }}>{q}</Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Ask */}
              <Animated.View entering={FadeInDown.duration(320).delay(210)} style={styles.section}>
                <Text style={{ ...t.overline, color: c.fgSubtle }}>{tr('askTitle')}</Text>

                <View style={[styles.askRow, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <TextInput
                    style={{ ...t.body, color: c.fg, flex: 1 }}
                    placeholder={tr('askPlaceholder')}
                    placeholderTextColor={c.fgSubtle}
                    value={question}
                    onChangeText={setQuestion}
                    onSubmitEditing={ask}
                    returnKeyType="send"
                    editable={!asking}
                  />
                  <Press haptic="light" scale={0.9} onPress={ask} disabled={asking}>
                    {asking ? (
                      <ActivityIndicator size="small" color={c.accent} />
                    ) : (
                      <Send size={18} color={question.trim() ? c.accent : c.fgSubtle} />
                    )}
                  </Press>
                </View>

                {answer && (
                  <Animated.View
                    entering={FadeIn}
                    style={[
                      styles.answerCard,
                      {
                        backgroundColor: c.surface,
                        borderColor: answer.grounded ? c.border : c.warning,
                      },
                    ]}
                  >
                    {!answer.grounded && (
                      <Text style={{ ...t.caption, color: c.warning, marginBottom: space.xs }}>
                        {tr('askNotCovered')}
                      </Text>
                    )}
                    <Text style={{ ...t.body, color: c.fg }}>{answer.answer}</Text>
                  </Animated.View>
                )}
              </Animated.View>

              {/* Generate material */}
              <Animated.View entering={FadeInDown.duration(320).delay(260)} style={styles.section}>
                <Text style={{ ...t.overline, color: c.fgSubtle }}>{tr('material')}</Text>

                <View style={{ gap: space.md, marginTop: space.md }}>
                  <Press
                    haptic="medium"
                    onPress={() => generate('flashcards')}
                    disabled={generating !== null}
                    style={[styles.genBtn, { backgroundColor: c.accent }]}
                  >
                    <BookOpen size={18} color={c.fgOnAccent} strokeWidth={2.2} />
                    <Text style={{ ...t.bodyStrong, color: c.fgOnAccent }}>
                      {generating === 'flashcards' ? tr('generating') : tr('makeFlashcards')}
                    </Text>
                  </Press>

                  <Press
                    haptic="medium"
                    onPress={() => generate('quiz')}
                    disabled={generating !== null}
                    style={[styles.genBtn, { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]}
                  >
                    <HelpCircle size={18} color={c.fg} strokeWidth={2.2} />
                    <Text style={{ ...t.bodyStrong, color: c.fg }}>
                      {generating === 'quiz' ? tr('generating') : tr('makeQuiz')}
                    </Text>
                  </Press>
                </View>

                {/* Already generated */}
                {(lesson.flashcard_sets.length > 0 || lesson.quizzes.length > 0) && (
                  <View style={{ gap: space.sm, marginTop: space.lg }}>
                    {lesson.flashcard_sets.map((set) => (
                      <Press
                        key={set.id}
                        scale={0.98}
                        onPress={() => router.push(`/flashcards/${set.id}`)}
                        style={[styles.materialRow, { borderColor: c.border }]}
                      >
                        <BookOpen size={15} color={c.fgMuted} />
                        <Text numberOfLines={1} style={{ ...t.label, color: c.fg, flex: 1 }}>
                          {set.title}
                        </Text>
                        <Text style={{ ...t.caption, color: c.fgSubtle }}>
                          {set._count.flashcards}
                        </Text>
                      </Press>
                    ))}
                    {lesson.quizzes.map((quiz) => (
                      <Press
                        key={quiz.id}
                        scale={0.98}
                        onPress={() => router.push(`/quizzes/${quiz.id}`)}
                        style={[styles.materialRow, { borderColor: c.border }]}
                      >
                        <HelpCircle size={15} color={c.fgMuted} />
                        <Text numberOfLines={1} style={{ ...t.label, color: c.fg, flex: 1 }}>
                          {quiz.title}
                        </Text>
                        <Text style={{ ...t.caption, color: c.fgSubtle }}>
                          {quiz._count.questions}
                        </Text>
                      </Press>
                    ))}
                  </View>
                )}
              </Animated.View>

              {/* Transcript, collapsed by default — it's the receipt, not the note */}
              {!!lesson.raw_text && (
                <View style={styles.section}>
                  <Press
                    haptic="light"
                    scale={0.98}
                    onPress={() => setShowTranscript((v) => !v)}
                    style={styles.transcriptToggle}
                  >
                    <Text style={{ ...t.label, color: c.fgMuted }}>
                      {showTranscript ? tr('hideTranscript') : tr('showTranscript')}
                    </Text>
                    {showTranscript ? (
                      <ChevronUp size={16} color={c.fgSubtle} />
                    ) : (
                      <ChevronDown size={16} color={c.fgSubtle} />
                    )}
                  </Press>

                  {showTranscript && (
                    <Animated.Text
                      entering={FadeIn}
                      style={{ ...t.label, color: c.fgSubtle, marginTop: space.md, lineHeight: 22 }}
                    >
                      {lesson.raw_text}
                    </Animated.Text>
                  )}
                </View>
              )}
            </>
          )}

          <View style={{ height: space.xxxl }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  iconBtn: { padding: space.sm },

  scroll: { paddingHorizontal: space.xl, paddingTop: space.md },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  section: { marginTop: space.xxl },

  stateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: space.xl,
  },

  pointCard: { padding: space.lg, borderRadius: radius.md, borderWidth: 1 },

  openRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },

  askRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: space.md,
  },
  answerCard: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: space.md,
  },

  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 16,
    borderRadius: radius.lg,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
  },

  transcriptToggle: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
