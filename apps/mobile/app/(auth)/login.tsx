import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppleSignInButton from '../../components/auth/AppleSignInButton';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { login } from '../../services/auth';

const COLORS = {
  background: '#0A0A0F',
  primary: '#1E40AF',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  error: '#FF4757',
};

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { message } = useLocalSearchParams<{ message?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email.trim()) { setError(t('login.emailRequired')); return; }
    if (!password) { setError(t('login.passwordRequired')); return; }

    setIsLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err?.code === 'auth/invalid-credential'
        ? t('login.invalidCredentials')
        : err?.message ?? t('login.genericError');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.container}>
          <View style={styles.brandSection}>
            <Image source={require('../../assets/quibly-text.png')} style={styles.brandImage} resizeMode="contain" />
            <Text style={styles.tagline}>{t('tagline')}</Text>
          </View>

          {message ? (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>{message}</Text>
            </View>
          ) : null}

          <View style={styles.formSection}>
            <Text style={styles.title}>{t('login.title')}</Text>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Input label={t('login.email')} placeholder={t('login.emailPlaceholder')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Input label={t('login.password')} placeholder={t('login.passwordPlaceholder')} value={password} onChangeText={setPassword} secureTextEntry />
            <Button title={t('login.button')} onPress={handleLogin} loading={isLoading} style={{ marginTop: 8 }} />
            <AppleSignInButton onError={setError} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('login.noAccount')}</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>{t('login.signUp')}</Text>
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
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40, justifyContent: 'center' },
  brandSection: { alignItems: 'center', marginBottom: 48 },
  brandImage: { width: 200, height: 60 },
  tagline: { fontSize: 16, color: COLORS.textSecondary, marginTop: 8, letterSpacing: 0.5 },
  successBanner: { backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', borderRadius: 12, padding: 14, marginBottom: 20 },
  successText: { color: '#10B981', fontSize: 14, textAlign: 'center', fontWeight: '500' },
  formSection: { width: '100%' },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 24 },
  errorBanner: { backgroundColor: 'rgba(255,71,87,0.12)', borderWidth: 1, borderColor: 'rgba(255,71,87,0.3)', borderRadius: 12, padding: 14, marginBottom: 20 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: 'center', fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  footerText: { color: COLORS.textSecondary, fontSize: 14 },
  footerLink: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
});
