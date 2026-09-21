import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import { signInWithApple } from '../../services/auth';

interface Props {
  onError: (message: string) => void;
}

export default function AppleSignInButton({ onError }: Props) {
  const { t } = useTranslation('auth');
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  if (Platform.OS !== 'ios' || !available) return null;

  const handlePress = async () => {
    try {
      await signInWithApple();
      router.replace('/(tabs)');
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') return;
      onError(err?.message ?? t('login.appleError'));
    }
  };

  return (
    <View style={styles.wrapper}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        // Preto porque o painel em volta é branco: o `WHITE` que servia ao vidro
        // escuro sumiria aqui. É o par que o guia da Apple pede para fundo claro.
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={12}
        style={styles.button}
        onPress={handlePress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  button: { width: '100%', height: 50 },
});
