import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Dimensions, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '@quibly/shared/constants';
import { ChevronRight, Check, BookOpen, GraduationCap, Target, Sparkles, Clock, Flame } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

const { width: W } = Dimensions.get('window');

const EDUCATION_OPTIONS = [
  { id: 'high_school', label: 'High School', icon: BookOpen, color: '#DBEAFE' },
  { id: 'college', label: 'College', icon: GraduationCap, color: '#D1FAE5' },
  { id: 'graduate', label: 'Graduate', icon: Target, color: '#EDE9FE' },
  { id: 'professional', label: 'Professional', icon: Sparkles, color: '#FEF3C7' },
];

const GOAL_OPTIONS = [
  { id: 'exam_prep', label: 'Exam Preparation', icon: Target, color: '#FEE2E2' },
  { id: 'school', label: 'School Subjects', icon: BookOpen, color: '#DBEAFE' },
  { id: 'certification', label: 'Certification', icon: GraduationCap, color: '#D1FAE5' },
  { id: 'fun', label: 'Learning for Fun', icon: Sparkles, color: '#FEF3C7' },
];

const SUBJECT_OPTIONS = [
  { name: 'Mathematics', color: '#1E40AF' },
  { name: 'Biology', color: '#059669' },
  { name: 'Chemistry', color: '#D97706' },
  { name: 'Physics', color: '#7C3AED' },
  { name: 'History', color: '#DC2626' },
  { name: 'Geography', color: '#0891B2' },
  { name: 'English', color: '#EC4899' },
  { name: 'Computer Science', color: '#1E40AF' },
  { name: 'Law', color: '#78716C' },
  { name: 'Medicine', color: '#059669' },
  { name: 'Business', color: '#D97706' },
  { name: 'Art', color: '#EC4899' },
];

const TIME_OPTIONS = [
  { minutes: 5, label: '5 min', subtitle: 'Casual', icon: Clock },
  { minutes: 15, label: '15 min', subtitle: 'Regular', icon: Clock },
  { minutes: 30, label: '30 min', subtitle: 'Serious', icon: Flame },
  { minutes: 60, label: '1 hour', subtitle: 'Intense', icon: Flame },
];

const TOTAL_STEPS = 6;

export default function OnboardingScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.username ?? '');
  const [education, setEducation] = useState('');
  const [goal, setGoal] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [dailyMinutes, setDailyMinutes] = useState(15);
  const [submitting, setSubmitting] = useState(false);

  const toggleSubject = (s: string) => {
    setSubjects((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const canContinue = () => {
    if (step === 0) return true;
    if (step === 1) return name.trim().length >= 2;
    if (step === 2) return !!education;
    if (step === 3) return !!goal;
    if (step === 4) return subjects.length > 0;
    if (step === 5) return true;
    return true;
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await api.post('/onboarding', {
        username: name.trim(),
        education_level: education,
        study_goal: goal,
        daily_goal_minutes: dailyMinutes,
        subjects,
      });
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (err) {
      console.error('[Onboarding] Error:', err);
      setSubmitting(false);
    }
  };

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <View style={styles.centerContent}>
            <Image source={require('../../assets/logo.png')} style={styles.welcomeLogo} resizeMode="contain" />
            <Text style={styles.welcomeTitle}>Welcome to Quibly!</Text>
            <Text style={styles.welcomeSub}>Let's personalize your study experience in a few quick steps.</Text>
          </View>
        )}

        {/* Step 1: Name */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What's your name?</Text>
            <Text style={styles.stepSub}>We'll use this to personalize your sessions.</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#8BA3BC"
              autoFocus
              maxLength={30}
            />
          </View>
        )}

        {/* Step 2: Education */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What's your level?</Text>
            <Text style={styles.stepSub}>This helps us tailor content difficulty.</Text>
            <View style={styles.optionsGrid}>
              {EDUCATION_OPTIONS.map((opt) => {
                const selected = education === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                    onPress={() => setEducation(opt.id)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: opt.color }]}>
                      <opt.icon size={22} color="#1A2E4A" />
                    </View>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{opt.label}</Text>
                    {selected && <View style={styles.checkCircle}><Check size={14} color="#FFFFFF" /></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 3: Goal */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What's your goal?</Text>
            <Text style={styles.stepSub}>We'll focus your study plan accordingly.</Text>
            <View style={styles.optionsGrid}>
              {GOAL_OPTIONS.map((opt) => {
                const selected = goal === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                    onPress={() => setGoal(opt.id)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: opt.color }]}>
                      <opt.icon size={22} color="#1A2E4A" />
                    </View>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{opt.label}</Text>
                    {selected && <View style={styles.checkCircle}><Check size={14} color="#FFFFFF" /></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 4: Subjects */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Pick your subjects</Text>
            <Text style={styles.stepSub}>Select all that apply. You can change later.</Text>
            <View style={styles.subjectsGrid}>
              {SUBJECT_OPTIONS.map((s) => {
                const selected = subjects.includes(s.name);
                return (
                  <TouchableOpacity
                    key={s.name}
                    style={[styles.subjectChip, selected && { backgroundColor: s.color + '20', borderColor: s.color }]}
                    onPress={() => toggleSubject(s.name)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.subjectDot, { backgroundColor: s.color }]} />
                    <Text style={[styles.subjectText, selected && { color: s.color, fontWeight: '700' }]}>{s.name}</Text>
                    {selected && <Check size={14} color={s.color} style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 5: Daily goal */}
        {step === 5 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Daily study goal</Text>
            <Text style={styles.stepSub}>How much time can you commit each day?</Text>
            <View style={styles.timeGrid}>
              {TIME_OPTIONS.map((opt) => {
                const selected = dailyMinutes === opt.minutes;
                return (
                  <TouchableOpacity
                    key={opt.minutes}
                    style={[styles.timeCard, selected && styles.timeCardSelected]}
                    onPress={() => setDailyMinutes(opt.minutes)}
                    activeOpacity={0.85}
                  >
                    <opt.icon size={24} color={selected ? '#FFFFFF' : '#1E40AF'} />
                    <Text style={[styles.timeLabel, selected && { color: '#FFFFFF' }]}>{opt.label}</Text>
                    <Text style={[styles.timeSub, selected && { color: 'rgba(255,255,255,0.7)' }]}>{opt.subtitle}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom button */}
      <View style={styles.bottomWrap}>
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue() && { opacity: 0.5 }]}
          onPress={handleNext}
          disabled={!canContinue() || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.continueBtnText}>
                {step === TOTAL_STEPS - 1 ? 'Start Studying' : 'Continue'}
              </Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EEF5FF' },
  progressWrap: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  progressTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#1E40AF', borderRadius: 3 },

  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 120 },

  // Welcome
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  welcomeLogo: { width: 80, height: 80, borderRadius: 20, marginBottom: 24 },
  welcomeTitle: { fontSize: 28, fontFamily: FONTS.bold, color: '#1A2E4A', marginBottom: 12 },
  welcomeSub: { fontSize: 16, fontFamily: FONTS.regular, color: '#8BA3BC', textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },

  // Step content
  stepContent: { paddingTop: 40 },
  stepTitle: { fontSize: 26, fontFamily: FONTS.bold, color: '#1A2E4A', marginBottom: 8 },
  stepSub: { fontSize: 15, fontFamily: FONTS.regular, color: '#8BA3BC', marginBottom: 28, lineHeight: 22 },

  // Name input
  nameInput: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 18, fontSize: 20, fontFamily: FONTS.medium, color: '#1A2E4A', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },

  // Option cards (2x2)
  optionsGrid: { gap: 12 },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 2, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  optionCardSelected: { borderColor: '#1E40AF', backgroundColor: '#EEF2FF' },
  optionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  optionLabel: { fontSize: 16, fontFamily: FONTS.semiBold, color: '#1A2E4A', flex: 1 },
  optionLabelSelected: { color: '#1E40AF' },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center' },

  // Subjects
  subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  subjectChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1.5, borderColor: '#E2E8F0' },
  subjectDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  subjectText: { fontSize: 14, fontFamily: FONTS.medium, color: '#4A6580' },

  // Time cards
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  timeCard: { width: (W - 48 - 12) / 2, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  timeCardSelected: { backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
  timeLabel: { fontSize: 18, fontFamily: FONTS.bold, color: '#1A2E4A', marginTop: 10, marginBottom: 2 },
  timeSub: { fontSize: 12, fontFamily: FONTS.regular, color: '#8BA3BC' },

  // Bottom
  bottomWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: 36, paddingTop: 16, backgroundColor: '#EEF5FF' },
  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1E40AF', borderRadius: 18, paddingVertical: 18, shadowColor: '#1E40AF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  continueBtnText: { fontSize: 17, fontFamily: FONTS.bold, color: '#FFFFFF' },
});
