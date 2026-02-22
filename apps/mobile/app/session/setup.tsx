import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Modal, TextInput, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@quibly/shared/constants';
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
    } catch (err) { console.error('[StartSession] Error:', err); setStarting(false); }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ArrowLeft size={18} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>Start Study Session</Text>

        <Text style={styles.sectionLabel}>Subject</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 28 }} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
          {subjects.map((subject) => (
            <TouchableOpacity key={subject.id}
              style={[styles.subjectPill, { borderColor: subject.color }, store.subjectId === subject.id && { backgroundColor: subject.color + '30', borderWidth: 2 }]}
              onPress={() => { store.setSubjectId(subject.id); store.setSubjectName(subject.name); store.setSubjectColor(subject.color); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
              <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
              <Text style={[styles.subjectPillText, store.subjectId === subject.id && { color: COLORS.text }]}>{subject.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addSubjectButton} onPress={() => setShowNewSubject(true)}>
            <Plus size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </ScrollView>

        <Text style={styles.sectionLabel}>Timer Mode</Text>
        <View style={styles.timerModeRow}>
          {timerModes.map((option) => (
            <TouchableOpacity key={option.mode}
              style={[styles.timerModeCard, store.timerMode === option.mode && styles.timerModeCardActive]}
              onPress={() => { store.setTimerMode(option.mode); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
              <Text style={[styles.timerModeLabel, store.timerMode === option.mode && { color: COLORS.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{option.label}</Text>
              <Text style={[styles.timerModeSubtitle, store.timerMode === option.mode && { color: COLORS.primaryLight }]} numberOfLines={1}>{option.subtitle}</Text>
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
                  <TouchableOpacity style={styles.durationButton} onPress={row.dec}><Minus size={18} color={COLORS.text} /></TouchableOpacity>
                  <Text style={styles.durationValue}>{row.value} min</Text>
                  <TouchableOpacity style={styles.durationButton} onPress={row.inc}><Plus size={18} color={COLORS.text} /></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.proofModeContainer}>
          <View style={styles.proofModeHeader}>
            <Text style={styles.sectionLabel}>Proof Mode</Text>
            <Switch value={store.proofMode} onValueChange={(val) => { store.setProofMode(val); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }} thumbColor={store.proofMode ? COLORS.primary : COLORS.textMuted} />
          </View>
          <Text style={styles.proofModeDescription}>
            Enable random photo checks. Earn <Text style={styles.proofModeHighlight}>+30% bonus SP</Text> and <Text style={styles.proofModeHighlight}>+50%</Text> if all pass.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.startButtonWrapper}>
        <TouchableOpacity style={[styles.startButton, (!store.subjectId || starting) && { opacity: 0.5 }]}
          onPress={handleStart} disabled={!store.subjectId || starting} activeOpacity={0.8}>
          {starting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.startButtonText}>START SESSION</Text>}
        </TouchableOpacity>
      </View>

      <Modal visible={showNewSubject} animationType="slide" transparent onRequestClose={() => setShowNewSubject(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Subject</Text>
            <TextInput style={styles.modalInput} placeholder="Subject name" placeholderTextColor={COLORS.textMuted}
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
                {creatingSubject ? <ActivityIndicator color={COLORS.text} size="small" /> : <Text style={styles.modalCreateText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  backButton: { paddingVertical: 8, marginTop: 4 },
  backText: { color: COLORS.textSecondary, fontSize: 16, fontFamily: FONTS.medium },
  title: { color: COLORS.text, fontSize: 28, fontFamily: FONTS.bold, marginTop: 12, marginBottom: 28 },
  sectionLabel: { color: COLORS.text, fontSize: 16, fontFamily: FONTS.semiBold, marginBottom: 12 },
  subjectPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  subjectDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  subjectPillText: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.medium },
  addSubjectButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  addSubjectText: { color: COLORS.textSecondary, fontSize: 20, fontFamily: FONTS.medium },
  timerModeRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  timerModeCard: { flex: 1, paddingVertical: 16, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: 'center' },
  timerModeCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '18' },
  timerModeLabel: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 4 },
  timerModeSubtitle: { color: COLORS.textMuted, fontSize: 11, fontFamily: FONTS.regular },
  customDuration: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 28, borderWidth: 1, borderColor: COLORS.border },
  durationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  durationLabel: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.medium },
  durationControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  durationButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  durationButtonText: { color: COLORS.text, fontSize: 18, fontFamily: FONTS.semiBold },
  durationValue: { color: COLORS.text, fontSize: 16, fontFamily: FONTS.semiBold, minWidth: 60, textAlign: 'center' },
  proofModeContainer: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 28, borderWidth: 1, borderColor: COLORS.border },
  proofModeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  proofModeDescription: { color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.regular, lineHeight: 19 },
  proofModeHighlight: { color: COLORS.secondary, fontFamily: FONTS.semiBold },
  startButtonWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 16, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border + '40' },
  startButton: { backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  startButtonText: { color: COLORS.text, fontSize: 17, fontFamily: FONTS.bold, letterSpacing: 1.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontFamily: FONTS.bold, marginBottom: 20 },
  modalInput: { backgroundColor: COLORS.surfaceLight, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.text, fontSize: 16, fontFamily: FONTS.medium, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  modalColorLabel: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.medium, marginBottom: 12 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  colorOption: { width: 36, height: 36, borderRadius: 18 },
  colorOptionSelected: { borderWidth: 3, borderColor: COLORS.text },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border },
  modalCancelText: { color: COLORS.textSecondary, fontSize: 16, fontFamily: FONTS.semiBold },
  modalCreateButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.primary },
  modalCreateText: { color: COLORS.text, fontSize: 16, fontFamily: FONTS.semiBold },
});
