import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Modal, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@quibly/shared/constants';
import { ArrowLeft, Plus, Minus } from 'lucide-react-native';
import type { Subject, TimerMode } from '@quibly/shared';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session.store';
import { useAuth } from '../../contexts/AuthContext';
import { getSubjects, createSubject as createSubjectService } from '../../services/subjects';

const SUBJECT_COLORS = [
  '#7C5CFC', '#00D4AA', '#FF6B6B', '#FFB84D', '#4ECDC4',
  '#FF6F91', '#957FEF', '#08D9D6', '#FF9671', '#00C9A7',
  '#FFC75F', '#F9F871', '#845EC2', '#D65DB1', '#0089BA',
];

export default function SessionSetupScreen() {
  const { t } = useTranslation('session');
  const router = useRouter();
  const { user, profile } = useAuth();
  const store = useSessionStore();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState(SUBJECT_COLORS[0]);
  const [creatingSubject, setCreatingSubject] = useState(false);

  const timerModes = useMemo(() => [
    { mode: 'pomodoro' as TimerMode, label: t('setup.pomodoro'), subtitle: t('setup.pomodoroSubtitle') },
    { mode: 'deep_focus' as TimerMode, label: t('setup.deepFocus'), subtitle: t('setup.deepFocusSubtitle') },
    { mode: 'custom' as TimerMode, label: t('setup.custom'), subtitle: t('setup.customSubtitle') },
  ], [t]);

  useEffect(() => {
    if (user) {
      store.setUserId(user.uid);
      store.setStreakDays(profile?.current_streak ?? 0);
    }
  }, [user, profile]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    if (!user) return;
    try {
      const subjectsData = await getSubjects(user.uid);
      setSubjects(subjectsData);
      if (subjectsData.length > 0 && !store.subjectId) {
        store.setSubjectId(subjectsData[0].id);
        store.setSubjectName(subjectsData[0].name);
        store.setSubjectColor(subjectsData[0].color);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim() || !user) return;
    setCreatingSubject(true);
    try {
      const subject = await createSubjectService(user.uid, newSubjectName.trim(), newSubjectColor);
      setSubjects((prev) => [...prev, subject]);
      store.setSubjectId(subject.id);
      store.setSubjectName(subject.name);
      store.setSubjectColor(subject.color);
      setShowNewSubject(false);
      setNewSubjectName('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {} finally { setCreatingSubject(false); }
  };

  const handleStart = async () => {
    if (!store.subjectId) return;
    setStarting(true);
    try {
      await store.startSession();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/session/active');
    } catch (err) { console.error('[StartSession]', err); setStarting(false); }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1E40AF" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={18} color="#8BA3BC" style={{ marginRight: 4 }} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Start Study Session</Text>

        <Text style={styles.sectionLabel}>Subject</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 28 }} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
          {subjects.map((subject) => (
            <TouchableOpacity key={subject.id}
              style={[styles.subjectPill, { borderColor: subject.color }, store.subjectId === subject.id && { backgroundColor: subject.color + '20', borderWidth: 2 }]}
              onPress={() => { store.setSubjectId(subject.id); store.setSubjectName(subject.name); store.setSubjectColor(subject.color); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
              <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
              <Text style={[styles.subjectPillText, store.subjectId === subject.id && { color: '#1A2E4A' }]}>{subject.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addSubjectButton} onPress={() => setShowNewSubject(true)}>
            <Plus size={20} color="#8BA3BC" />
          </TouchableOpacity>
        </ScrollView>

        <Text style={styles.sectionLabel}>Timer Mode</Text>
        <View style={styles.timerModeRow}>
          {timerModes.map((option) => (
            <TouchableOpacity key={option.mode}
              style={[styles.timerModeCard, store.timerMode === option.mode && styles.timerModeCardActive]}
              onPress={() => { store.setTimerMode(option.mode); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
              <Text style={[styles.timerModeLabel, store.timerMode === option.mode && { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{option.label}</Text>
              <Text style={[styles.timerModeSubtitle, store.timerMode === option.mode && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>{option.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {store.timerMode === 'custom' && (
          <View style={styles.customDuration}>
            {[
              { label: 'Work Duration', value: store.workDuration, dec: () => store.setWorkDuration(Math.max(5, store.workDuration - 5)), inc: () => store.setWorkDuration(Math.min(120, store.workDuration + 5)) },
              { label: 'Break Duration', value: store.breakDuration, dec: () => store.setBreakDuration(Math.max(1, store.breakDuration - 1)), inc: () => store.setBreakDuration(Math.min(30, store.breakDuration + 1)) },
            ].map((row) => (
              <View key={row.label} style={styles.durationRow}>
                <Text style={styles.durationLabel}>{row.label}</Text>
                <View style={styles.durationControls}>
                  <TouchableOpacity style={styles.durationButton} onPress={row.dec}><Minus size={18} color="#1A2E4A" /></TouchableOpacity>
                  <Text style={styles.durationValue}>{row.value} min</Text>
                  <TouchableOpacity style={styles.durationButton} onPress={row.inc}><Plus size={18} color="#1A2E4A" /></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.proofModeContainer}>
          <View style={styles.proofModeHeader}>
            <Text style={styles.sectionLabel}>Proof Mode</Text>
            <Switch value={store.proofMode} onValueChange={(val) => { store.setProofMode(val); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              trackColor={{ false: '#E2E8F0', true: '#93C5FD' }} thumbColor={store.proofMode ? '#1E40AF' : '#CBD5E1'} />
          </View>
          <Text style={styles.proofModeDescription}>
            Enable random photo checks. Earn <Text style={styles.proofModeHighlight}>+30% bonus SP</Text> and <Text style={styles.proofModeHighlight}>+50%</Text> if all pass.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.startButtonWrapper}>
        <TouchableOpacity style={[styles.startButton, (!store.subjectId || starting) && { opacity: 0.5 }]}
          onPress={handleStart} disabled={!store.subjectId || starting} activeOpacity={0.85}>
          {starting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.startButtonText}>START SESSION</Text>}
        </TouchableOpacity>
      </View>

      <Modal visible={showNewSubject} animationType="slide" transparent onRequestClose={() => setShowNewSubject(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Subject</Text>
            <TextInput style={styles.modalInput} placeholder="Subject name" placeholderTextColor="#8BA3BC"
              value={newSubjectName} onChangeText={setNewSubjectName} autoFocus maxLength={30} />
            <Text style={styles.modalColorLabel}>Color</Text>
            <View style={styles.colorGrid}>
              {SUBJECT_COLORS.map((color) => (
                <TouchableOpacity key={color} style={[styles.colorOption, { backgroundColor: color }, newSubjectColor === color && styles.colorOptionSelected]}
                  onPress={() => setNewSubjectColor(color)} />
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowNewSubject(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalCreateButton, (!newSubjectName.trim() || creatingSubject) && { opacity: 0.5 }]}
                onPress={handleCreateSubject} disabled={!newSubjectName.trim() || creatingSubject}>
                {creatingSubject ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalCreateText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF5FF' },
  loadingContainer: { flex: 1, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  backButton: { paddingVertical: 8, marginTop: 4, flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#8BA3BC', fontSize: 16, fontFamily: FONTS.medium },
  title: { color: '#1A2E4A', fontSize: 28, fontFamily: FONTS.bold, marginTop: 12, marginBottom: 28 },
  sectionLabel: { color: '#1A2E4A', fontSize: 16, fontFamily: FONTS.semiBold, marginBottom: 12 },

  subjectPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  subjectDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  subjectPillText: { color: '#8BA3BC', fontSize: 14, fontFamily: FONTS.medium },
  addSubjectButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },

  timerModeRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  timerModeCard: { flex: 1, paddingVertical: 16, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  timerModeCardActive: { backgroundColor: '#1E40AF' },
  timerModeLabel: { color: '#4A6580', fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 4 },
  timerModeSubtitle: { color: '#8BA3BC', fontSize: 11, fontFamily: FONTS.regular },

  customDuration: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  durationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  durationLabel: { color: '#4A6580', fontSize: 14, fontFamily: FONTS.medium },
  durationControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  durationButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  durationValue: { color: '#1A2E4A', fontSize: 16, fontFamily: FONTS.semiBold, minWidth: 60, textAlign: 'center' },

  proofModeContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  proofModeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  proofModeDescription: { color: '#8BA3BC', fontSize: 13, fontFamily: FONTS.regular, lineHeight: 19 },
  proofModeHighlight: { color: '#059669', fontFamily: FONTS.semiBold },

  startButtonWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 16, backgroundColor: '#EEF5FF' },
  startButton: { backgroundColor: '#1E40AF', paddingVertical: 18, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#1E40AF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  startButtonText: { color: '#FFFFFF', fontSize: 17, fontFamily: FONTS.bold, letterSpacing: 1.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#1A2E4A', fontSize: 22, fontFamily: FONTS.bold, marginBottom: 20 },
  modalInput: { backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#1A2E4A', fontSize: 16, fontFamily: FONTS.medium, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 20 },
  modalColorLabel: { color: '#4A6580', fontSize: 14, fontFamily: FONTS.medium, marginBottom: 12 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  colorOption: { width: 36, height: 36, borderRadius: 18 },
  colorOptionSelected: { borderWidth: 3, borderColor: '#1A2E4A' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#F1F5F9' },
  modalCancelText: { color: '#64748B', fontSize: 16, fontFamily: FONTS.semiBold },
  modalCreateButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#1E40AF' },
  modalCreateText: { color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.semiBold },
});
