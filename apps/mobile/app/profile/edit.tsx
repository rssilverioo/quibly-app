import React, { useMemo, useState } from 'react';
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
import { useTheme, type Palette, text as ty, space, radius } from '../../theme';

/*
 * O mapa de cor que existia aqui era o defeito que `MARCA.md §2` item 4
 * documenta, inteiro, num arquivo só:
 *
 *   surface: c.bg          → o card tinha a cor da página
 *   border: c.surfaceRaised → a borda tinha a cor de outra superfície
 *   textSecondary: c.fgSubtle / textMuted: c.fgMuted → invertidos, o que
 *     fazia o texto secundário ficar MAIS apagado que o terciário
 *
 * E o botão de salvar pintava `c.fg` (#17171B) sobre `c.accent` (#0043BA):
 * 2,1:1, ilegível. O par do accent é `fgOnAccent`.
 *
 * Não sobrou mapa: a tela lê `c` direto, como todas as outras.
 */

export default function EditProfileScreen() {
  const { t } = useTranslation('profile');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
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
            <ArrowLeft size={18} color={c.accent} style={{ marginRight: 4 }} />
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
            placeholderTextColor={c.fgSubtle}
            value={username}
            onChangeText={handleAutoHandle}
            autoCorrect={false}
            selectionColor={c.accent}
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
              placeholderTextColor={c.fgSubtle}
              value={handle}
              onChangeText={(v) => setHandle(v.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={c.accent}
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
            placeholderTextColor={c.fgSubtle}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            selectionColor={c.accent}
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
            <ActivityIndicator size="small" color={c.fgOnAccent} />
          ) : (
            <Text style={styles.saveButtonText}>{t('edit.saveChanges')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.bg },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  header: { paddingTop: space.md, paddingBottom: space.sm },
  backText: { ...ty.label, color: c.accent },
  title: { ...ty.title2, color: c.fg, marginBottom: space.xl },
  field: { marginBottom: space.xl },
  label: { ...ty.label, color: c.fgMuted, marginBottom: space.sm },
  labelOptional: { color: c.fgSubtle },
  input: {
    ...ty.body,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    color: c.fg,
  },
  inputError: { borderColor: c.danger },
  inputMultiline: { minHeight: 80, paddingTop: space.md },
  handleInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    paddingLeft: space.lg,
  },
  handlePrefix: { ...ty.body, color: c.fgMuted, marginRight: 2 },
  handleInput: {
    ...ty.body,
    flex: 1,
    paddingVertical: space.md,
    paddingRight: space.lg,
    color: c.fg,
    borderWidth: 0,
  },
  errorText: { ...ty.caption, color: c.danger, marginTop: space.xs },
  hint: { ...ty.caption, color: c.fgMuted, marginTop: space.xs },
  saveButton: {
    height: 54,
    backgroundColor: c.accent,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { ...ty.bodyStrong, color: c.fgOnAccent },
});
