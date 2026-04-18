import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { updateProfile } from '../../services/auth';

const COLORS = {
  background: '#0A0A0F',
  surface: '#141420',
  surfaceLight: '#1E1E2E',
  border: '#2A2A3E',
  primary: '#1E40AF',
  primaryLight: '#2B53D8',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  error: '#FF4757',
};

export default function EditProfileScreen() {
  const { t } = useTranslation('profile');
  const { profile, setProfile } = useAuth();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; handle?: string }>({});

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!username.trim()) errs.username = t('edit.usernameRequired');
    else if (username.trim().length < 2) errs.username = t('edit.usernameMinLength');
    if (!handle.trim()) errs.handle = t('edit.handleRequired');
    else if (handle.trim().length < 3) errs.handle = t('edit.handleMinLength');
    else if (!/^[a-zA-Z0-9_]+$/.test(handle.trim()))
      errs.handle = t('edit.handleInvalidChars');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const updated = await updateProfile({
        username: username.trim(),
        handle: handle.trim().toLowerCase(),
        bio: bio.trim() || undefined,
      });
      setProfile(updated);
      Alert.alert(t('edit.savedTitle'), t('edit.savedMessage'));
      router.back();
    } catch (err: any) {
      const msg = err?.message?.includes('handle')
        ? t('edit.handleTaken')
        : err?.message ?? t('edit.updateError');
      Alert.alert(t('common:error'), msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoHandle = (text: string) => {
    setUsername(text);
    // Auto-generate handle from username if user hasn't manually edited it
    if (handle === profile?.handle || handle === '') {
      const auto = text.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      setHandle(auto);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
          >
            <ArrowLeft size={18} color={COLORS.primaryLight} style={{ marginRight: 4 }} />
            <Text style={styles.backText}>{t('common:back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('edit.title')}</Text>
        </View>

        {/* Username */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('edit.username')}</Text>
          <TextInput
            style={[styles.input, errors.username ? styles.inputError : null]}
            placeholder={t('edit.usernamePlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={username}
            onChangeText={handleAutoHandle}
            autoCorrect={false}
            selectionColor={COLORS.primaryLight}
            maxLength={30}
          />
          {errors.username ? (
            <Text style={styles.errorText}>{errors.username}</Text>
          ) : null}
        </View>

        {/* Handle */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('edit.handle')}</Text>
          <View style={styles.handleInputWrapper}>
            <Text style={styles.handlePrefix}>@</Text>
            <TextInput
              style={[styles.handleInput, errors.handle ? styles.inputError : null]}
              placeholder={t('edit.handlePlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={handle}
              onChangeText={(v) => setHandle(v.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={COLORS.primaryLight}
              maxLength={30}
            />
          </View>
          {errors.handle ? (
            <Text style={styles.errorText}>{errors.handle}</Text>
          ) : (
            <Text style={styles.hint}>{t('edit.handleHint')}</Text>
          )}
        </View>

        {/* Bio */}
        <View style={styles.field}>
          <Text style={styles.label}>
            {t('edit.bio')} <Text style={styles.labelOptional}>{t('common:optional')}</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={t('edit.bioPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            selectionColor={COLORS.primaryLight}
            maxLength={200}
          />
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <Text style={styles.saveButtonText}>{t('edit.saveChanges')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { paddingTop: 12, paddingBottom: 8 },
  backText: { color: COLORS.primaryLight, fontSize: 16, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '700', marginBottom: 24 },
  field: { marginBottom: 20 },
  label: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500', marginBottom: 8 },
  labelOptional: { color: COLORS.textMuted, fontWeight: '400' },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
  },
  inputError: { borderColor: COLORS.error },
  inputMultiline: { minHeight: 80, paddingTop: 14 },
  handleInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingLeft: 16,
  },
  handlePrefix: { color: COLORS.textMuted, fontSize: 16, fontWeight: '600', marginRight: 2 },
  handleInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 16,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 0,
  },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 6 },
  hint: { color: COLORS.textMuted, fontSize: 12, marginTop: 6 },
  saveButton: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
});
