import { router } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { register } from '../../services/auth';

const COLORS = {
  background: '#0A0A0F',
  primary: '#1E40AF',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  error: '#FF4757',
};

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterScreen() {
  const { t } = useTranslation('auth');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (!username.trim()) errors.username = t('register.usernameRequired');
    else if (username.trim().length < 2) errors.username = t('register.usernameMinLength');
    if (!email.trim()) errors.email = t('register.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = t('register.emailInvalid');
    if (!password) errors.password = t('register.passwordRequired');
    else if (password.length < 6) errors.password = t('register.passwordMinLength');
    if (!confirmPassword) errors.confirmPassword = t('register.confirmRequired');
    else if (password !== confirmPassword) errors.confirmPassword = t('register.passwordMismatch');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    setError('');
    if (!validate()) return;
    setIsLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, username.trim());
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err?.code === 'auth/email-already-in-use'
        ? t('register.emailExists')
        : err?.message ?? t('register.genericError');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.container}>
          <View style={styles.headerSection}>
            <Text style={styles.title}>{t('register.title')}</Text>
            <Text style={styles.subtitle}>{t('register.subtitle')}</Text>
          </View>

          {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}

          <View style={styles.formSection}>
            <Input label={t('register.username')} placeholder={t('register.usernamePlaceholder')} value={username}
              onChangeText={(v) => { setUsername(v); setFieldErrors((p) => ({ ...p, username: undefined })); }}
              autoCapitalize="words" error={fieldErrors.username} />
            <Input label={t('register.email')} placeholder={t('register.emailPlaceholder')} value={email}
              onChangeText={(v) => { setEmail(v); setFieldErrors((p) => ({ ...p, email: undefined })); }}
              keyboardType="email-address" autoCapitalize="none" error={fieldErrors.email} />
            <Input label={t('register.password')} placeholder={t('register.passwordPlaceholder')} value={password}
              onChangeText={(v) => { setPassword(v); setFieldErrors((p) => ({ ...p, password: undefined })); }}
              secureTextEntry error={fieldErrors.password} hint={t('register.passwordHint')} />
            <Input label={t('register.confirmPassword')} placeholder={t('register.confirmPasswordPlaceholder')} value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }}
              secureTextEntry error={fieldErrors.confirmPassword} />
            <Button title={t('register.button')} onPress={handleRegister} loading={isLoading} style={{ marginTop: 8 }} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('register.hasAccount')}</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>{t('register.logIn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  headerSection: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, lineHeight: 22 },
  errorBanner: { backgroundColor: 'rgba(255,71,87,0.12)', borderWidth: 1, borderColor: 'rgba(255,71,87,0.3)', borderRadius: 12, padding: 14, marginBottom: 20 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: 'center', fontWeight: '500' },
  formSection: { width: '100%' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 32, paddingBottom: 16 },
  footerText: { color: COLORS.textSecondary, fontSize: 14 },
  footerLink: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
});
