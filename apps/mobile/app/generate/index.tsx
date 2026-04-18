import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@quibly/shared/constants';
import { ArrowLeft, Sparkles, BookOpen, HelpCircle } from 'lucide-react-native';
import { generateFromTopic, generateFlashcardsFromDocument, generateQuizFromDocument } from '../../services/generate';
import { useUsage } from '../../hooks/useUsage';
import i18n from '../../lib/i18n';

type GenType = 'flashcards' | 'quiz';

export default function GenerateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ topic?: string; documentId?: string; documentTitle?: string; autoType?: string }>();
  const { t } = useTranslation('documents');
  const { canCreate, refresh: refreshUsage } = useUsage();

  const [topic, setTopic] = useState(params.topic ?? '');
  const [genType, setGenType] = useState<GenType>((params.autoType as GenType) ?? 'flashcards');
  const [isGenerating, setIsGenerating] = useState(false);
  const isFromDocument = !!params.documentId;

  // Auto-generate if coming from upload with autoType
  useEffect(() => {
    if (params.autoType && params.documentId) {
      handleGenerate(params.autoType as GenType);
    }
  }, []);

  const handleGenerate = async (type?: GenType) => {
    const selectedType = type ?? genType;
    const usageType = selectedType === 'flashcards' ? 'flashcard_sets' : 'quizzes';

    if (!canCreate(usageType)) {
      Alert.alert(t('pricing:title'), t('pricing:upgrade'));
      router.push('/pricing');
      return;
    }

    setIsGenerating(true);
    try {
      const lang = i18n.language;
      let result;

      if (isFromDocument && params.documentId) {
        if (selectedType === 'flashcards') {
          result = await generateFlashcardsFromDocument(params.documentId, lang);
        } else {
          result = await generateQuizFromDocument(params.documentId, lang);
        }
      } else {
        if (!topic.trim()) return;
        result = await generateFromTopic(topic.trim(), selectedType, lang);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refreshUsage();

      if (selectedType === 'flashcards') {
        router.replace(`/flashcards/${result.id}`);
      } else {
        router.replace(`/quizzes/${result.id}`);
      }
    } catch (err: any) {
      Alert.alert(t('common:error'), err?.message ?? 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isFromDocument ? params.documentTitle : t('home:generateByTopic')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {isGenerating ? (
          <View style={styles.generatingContainer}>
            <ActivityIndicator size="large" color={COLORS.secondary} />
            <Text style={styles.generatingText}>
              <Sparkles size={16} color={COLORS.secondary} /> Generating...
            </Text>
          </View>
        ) : (
          <View style={styles.formContainer}>
            {/* Topic input (only for topic-based) */}
            {!isFromDocument && (
              <TextInput
                style={styles.input}
                placeholder={t('home:topicPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                value={topic}
                onChangeText={setTopic}
                multiline
              />
            )}

            {/* Type Toggle */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, genType === 'flashcards' && styles.toggleActive]}
                activeOpacity={0.8}
                onPress={() => setGenType('flashcards')}
              >
                <BookOpen size={18} color={genType === 'flashcards' ? COLORS.text : COLORS.textMuted} />
                <Text style={[styles.toggleText, genType === 'flashcards' && styles.toggleTextActive]}>
                  {t('flashcards:title')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, genType === 'quiz' && styles.toggleActive]}
                activeOpacity={0.8}
                onPress={() => setGenType('quiz')}
              >
                <HelpCircle size={18} color={genType === 'quiz' ? COLORS.text : COLORS.textMuted} />
                <Text style={[styles.toggleText, genType === 'quiz' && styles.toggleTextActive]}>
                  {t('quizzes:title')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Generate Button */}
            <TouchableOpacity
              style={[styles.generateButton, (!isFromDocument && !topic.trim()) && { opacity: 0.5 }]}
              activeOpacity={0.8}
              onPress={() => handleGenerate()}
              disabled={!isFromDocument && !topic.trim()}
            >
              <Sparkles size={20} color={COLORS.background} style={{ marginRight: 8 }} />
              <Text style={styles.generateButtonText}>{t('home:generate')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text, flex: 1, textAlign: 'center' },
  formContainer: { flex: 1, paddingTop: 16 },
  input: { backgroundColor: COLORS.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16, color: COLORS.text, fontSize: 16, fontFamily: FONTS.regular, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24, minHeight: 80, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.surface, borderRadius: 14, paddingVertical: 16, borderWidth: 1, borderColor: COLORS.border },
  toggleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleText: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.textMuted },
  toggleTextActive: { color: COLORS.text },
  generateButton: { backgroundColor: COLORS.secondary, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  generateButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.background },
  generatingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  generatingText: { fontSize: 16, fontFamily: FONTS.medium, color: COLORS.textSecondary, marginTop: 16 },
});
