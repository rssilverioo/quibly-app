import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import AppleSignInButton from '../../components/auth/AppleSignInButton';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import { trackScreen } from '../../lib/analytics';
import { COELHOS } from '../../assets/coelhos';
import { AZUL_DA_MARCA, COR_DA_ABERTURA } from '../../lib/abertura';
import { useTheme, type Palette, text as ty, space, radius } from '../../theme';

/**
 * O login é a primeira tela do app, e parece o app.
 *
 * ## O que esta tela era, e por que mudou
 *
 * Era um painel de vidro escuro sobre a fotografia de uma cidade americana —
 * a única tela escura de um app inteiro claro, e a única com foto. Funcionava,
 * mas dependia de dois gradientes para o wordmark branco ser legível e contava
 * uma história (Nova York, São Francisco) que não é a do produto.
 *
 * Agora ela é feita do mesmo material do resto: o fundo `bg`, uma superfície
 * branca com borda hairline, e o coelho desenhado no mesmo traço dos coelhos
 * do onboarding. Quem entra já está dentro.
 *
 * ## Por que o fundo é literal, e não `c.bg`
 *
 * Esta tela sucede a abertura, que sucede o splash nativo, e os três precisam
 * da mesma cor para a passagem não piscar. `COR_DA_ABERTURA` é essa cor, e é
 * o `bg` do tema claro — a moldura da marca não segue o tema escuro
 * (`DESIGN-GYMRATS §5.15`). Dentro do painel, os tokens do tema claro valem.
 */

const MARCA = { largura: 152, altura: 61 };

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { message } = useLocalSearchParams<{ message?: string }>();
  const [error, setError] = useState('');

  useEffect(() => {
    trackScreen('login');
  }, []);

  return (
    <View style={styles.raiz}>
      <ScrollView
        contentContainerStyle={[
          styles.rolagem,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl },
        ]}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1 — a marca: wordmark azul e a tagline em overline */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.marca}>
          <Image
            source={require('../../assets/quibly-text.png')}
            style={styles.marcaImagem}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>{t('tagline')}</Text>
        </Animated.View>

        {/* 2 — o coelho, no meio, com ar em volta. Nada por cima dele. */}
        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.coelho}>
          <Image source={COELHOS.celular_quibly} style={styles.coelhoImagem} resizeMode="contain" />
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* 3 — o painel de entrada: superfície branca, borda hairline */}
        <Animated.View entering={FadeInDown.delay(240).duration(500)} style={styles.painel}>
          {message ? (
            <View style={[styles.aviso, styles.avisoBom]}>
              <Text style={styles.avisoBomTexto}>{message}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={[styles.aviso, styles.avisoRuim]}>
              <Text style={styles.avisoRuimTexto}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.chamada}>{t('login.socialSubtitle')}</Text>

          {/*
            Os dois botões seguem as regras das plataformas: o da Apple é uma
            view do sistema e o do Google segue medidas e cores prescritas.
            O painel é o que os segura; eles não mudam.
          */}
          <View style={styles.botoes}>
            <AppleSignInButton onError={setError} />
            <GoogleSignInButton onError={setError} />
          </View>

          <Text style={styles.legal}>{t('login.legal')}</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  raiz: { flex: 1, backgroundColor: COR_DA_ABERTURA },
  rolagem: { flexGrow: 1, paddingHorizontal: space.xl },

  marca: { alignItems: 'center', gap: space.sm },
  marcaImagem: { width: MARCA.largura, height: MARCA.altura, tintColor: AZUL_DA_MARCA },
  tagline: { ...ty.overline, color: c.fgMuted, textAlign: 'center' },

  coelho: { alignItems: 'center', marginTop: space.xxl },
  coelhoImagem: { width: 240, height: 240 },

  painel: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: space.lg,
    marginTop: space.xl,
  },
  chamada: { ...ty.body, color: c.fgMuted, textAlign: 'center', marginBottom: space.lg },
  botoes: { gap: space.md },
  aviso: { borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  avisoBom: { backgroundColor: 'rgba(19,122,56,0.10)' },
  avisoBomTexto: { ...ty.caption, color: c.success, textAlign: 'center' },
  avisoRuim: { backgroundColor: c.liveSoft },
  avisoRuimTexto: { ...ty.caption, color: c.live, textAlign: 'center' },
  legal: { ...ty.caption, color: c.fgSubtle, textAlign: 'center', marginTop: space.lg },
});
