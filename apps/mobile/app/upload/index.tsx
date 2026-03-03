import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@quibly/shared/constants';
import { ArrowLeft, Upload, FileText, Check, BookOpen, HelpCircle } from 'lucide-react-native';
import { uploadDocument } from '../../services/documents';

type UploadState = 'idle' | 'selected' | 'uploading' | 'success';
type GenType = 'flashcards' | 'quiz';

export default function UploadScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { t } = useTranslation('documents');
  const [state, setState] = useState<UploadState>('idle');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<GenType>(type === 'quiz' ? 'quiz' : 'flashcards');

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFile({ uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/pdf' });
      if (!title) setTitle(asset.name.replace(/\.pdf$/i, ''));
      setState('selected');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setState('uploading');
    try {
      const doc = await uploadDocument(file, title.trim());
      setUploadedDocId(doc.id);
      setState('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setState('selected');
      Alert.alert(t('common:error'), err?.message ?? 'Upload failed');
    }
  };

  const handleGenerate = () => {
    if (!uploadedDocId) return;
    router.replace({ pathname: '/generate', params: { documentId: uploadedDocId, documentTitle: title, autoType: selectedType } } as any);
  };

  const TypeToggle = () => (
    <View style={styles.toggleRow}>
      <TouchableOpacity
        style={[styles.toggleBtn, selectedType === 'flashcards' && styles.toggleActive]}
        activeOpacity={0.8}
        onPress={() => setSelectedType('flashcards')}
      >
        <BookOpen size={18} color={selectedType === 'flashcards' ? COLORS.text : COLORS.textMuted} />
        <Text style={[styles.toggleText, selectedType === 'flashcards' && styles.toggleTextActive]}>
          Flashcards
        </Text>
        {selectedType === 'flashcards' && <Check size={16} color={COLORS.text} />}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleBtn, selectedType === 'quiz' && styles.toggleActive]}
        activeOpacity={0.8}
        onPress={() => setSelectedType('quiz')}
      >
        <HelpCircle size={18} color={selectedType === 'quiz' ? COLORS.text : COLORS.textMuted} />
        <Text style={[styles.toggleText, selectedType === 'quiz' && styles.toggleTextActive]}>
          Quiz
        </Text>
        {selectedType === 'quiz' && <Check size={16} color={COLORS.text} />}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('uploadTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {state === 'success' ? (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Check size={40} color={COLORS.success} />
            </View>
            <Text style={styles.successTitle}>{t('uploadSuccess')}</Text>
            <Text style={styles.successMessage}>{t('uploadSuccessMessage')}</Text>

            <TypeToggle />

            <Text style={styles.indicatorText}>
              {selectedType === 'flashcards' ? t('flashcardsWillBeGenerated') : t('quizWillBeGenerated')}
            </Text>

            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8} onPress={handleGenerate}>
              <Text style={styles.primaryButtonText}>{t('generate')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formContainer}>
            {/* File Picker */}
            <TouchableOpacity style={styles.fileZone} activeOpacity={0.8} onPress={handlePickFile}>
              {file ? (
                <View style={styles.fileSelected}>
                  <FileText size={28} color={COLORS.primary} />
                  <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                </View>
              ) : (
                <View style={styles.fileEmpty}>
                  <Upload size={32} color={COLORS.primary} />
                  <Text style={styles.fileEmptyText}>{t('selectFile')}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Type Toggle */}
            <TypeToggle />

            {/* Title Input */}
            <Text style={styles.label}>{t('titleLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('titlePlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            {/* Upload Button */}
            <TouchableOpacity
              style={[styles.primaryButton, (!file || !title.trim() || state === 'uploading') && { opacity: 0.5 }]}
              activeOpacity={0.8}
              onPress={handleUpload}
              disabled={!file || !title.trim() || state === 'uploading'}
            >
              {state === 'uploading' ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.primaryButtonText}>{t('upload')}</Text>
              )}
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
  headerTitle: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
  formContainer: { flex: 1, paddingTop: 16 },
  fileZone: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed', marginBottom: 24 },
  fileEmpty: { alignItems: 'center' },
  fileEmptyText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary, marginTop: 12 },
  fileSelected: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileName: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.text, flex: 1 },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 24, width: '100%' },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.surface, borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: COLORS.border },
  toggleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleText: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.textMuted },
  toggleTextActive: { color: COLORS.text },
  label: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.textSecondary, marginBottom: 8 },
  input: { backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.text, fontSize: 16, fontFamily: FONTS.regular, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12, width: '100%' },
  primaryButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.success + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { fontSize: 24, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 8 },
  successMessage: { fontSize: 15, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  indicatorText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
});
