import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppleSignInButton from '../../components/auth/AppleSignInButton';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';

const COLORS = {
  background: '#0A0A0F',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  error: '#FF4757',
  success: '#10B981',
};

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { message } = useLocalSearchParams<{ message?: string }>();
  const [error, setError] = useState('');

  return (
    <View style={styles.flex}>
      <LinearGradient
        colors={['#1E1B4B', '#0A0A0F', '#0A0A0F']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Image
              source={require('../../assets/quibly-text.png')}
              style={styles.brandImage}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>{t('tagline')}</Text>
          </View>

          {message ? (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>{message}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Text style={styles.heading}>{t('login.title')}</Text>
            <Text style={styles.subheading}>{t('login.socialSubtitle')}</Text>

            <View style={styles.buttons}>
              <AppleSignInButton onError={setError} />
              <GoogleSignInButton onError={setError} />
            </View>

            <Text style={styles.legal}>{t('login.legal')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  glow: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 360,
    opacity: 0.35,
  },
  glowTop: {
    top: -120,
    right: -120,
    backgroundColor: '#3B82F6',
  },
  glowBottom: {
    bottom: -160,
    left: -120,
    backgroundColor: '#7C3AED',
    opacity: 0.25,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 56,
  },
  logo: {
    width: 88,
    height: 88,
    marginBottom: 20,
    borderRadius: 22,
  },
  brandImage: {
    width: 180,
    height: 48,
  },
  tagline: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 12,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  successText: {
    color: COLORS.success,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: 'rgba(255,71,87,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  actions: {
    width: '100%',
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
    lineHeight: 21,
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  legal: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: 28,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
