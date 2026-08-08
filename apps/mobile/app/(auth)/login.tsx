import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import AppleSignInButton from '../../components/auth/AppleSignInButton';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import Glass from '../../components/ui/Glass';
import { trackScreen } from '../../lib/analytics';
import {
  AZUL_ABERTURA,
  ZOOM_FINAL,
  cidadeDaAbertura,
  escalaDaAproximacao,
  restanteDaAproximacaoMs,
} from '../../lib/abertura';
import { text as ty, space, radius } from '../../theme';

/**
 * O login é a mesma fotografia da abertura, ainda se aproximando.
 *
 * ## O que esta tela era, e por que mudou
 *
 * Antes ela era um palco desenhado: gradiente de céu noturno, nuvens à deriva,
 * fórmulas fantasma piscando, partículas e um logo que descia do centro. Tudo
 * isso existia para dar à abertura uma imagem própria — e existia porque não
 * havia imagem nenhuma. Agora há: a cidade que o `CitySplash` já está
 * mostrando. Manter as duas seria pôr um cenário na frente de outro.
 *
 * ## Por que não há transição entre o splash e o login
 *
 * Porque não há troca a esconder. As duas telas leem a mesma cidade e a mesma
 * curva de zoom de `lib/abertura`, então o que acontece na montagem é só o
 * `CitySplash` sair de cena com a fotografia parada no lugar. A única coisa
 * que aparece é a interface, e ela aparece por fade — que é o único movimento
 * que esta tela ainda faz por conta própria.
 *
 * ## Por que o palco não segue o tema
 *
 * `DESIGN-GYMRATS §5.15`: esta é a moldura da marca, não uma superfície de
 * produto. Ela é escura mesmo com o app claro — daí `Glass` receber
 * `scheme="dark"` e os textos serem alfas de branco literais em vez de `c.fg`,
 * que é a cor de texto da *superfície do tema* e aqui viraria preto sobre a
 * foto.
 */

const MARCA = { largura: 168, altura: 46 };

/** Quanto o rodapé de vidro escurece a foto atrás dele, do topo para o pé. */
const SCRIM_INFERIOR = [
  'transparent',
  'rgba(6,14,32,0.35)',
  'rgba(6,14,32,0.82)',
  'rgba(4,10,26,0.94)',
] as const;

/** O céu das três cidades é claro; sem isto o wordmark branco some nele. */
const SCRIM_SUPERIOR = ['rgba(4,10,26,0.55)', 'transparent'] as const;

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(), []);
  const { message } = useLocalSearchParams<{ message?: string }>();
  const [error, setError] = useState('');

  // A câmera continua de onde o splash parou — não recomeça. Ver a nota em
  // `INICIO_DA_ABERTURA`.
  const escala = useSharedValue(escalaDaAproximacao());
  const uiOpacity = useSharedValue(0);

  useEffect(() => {
    trackScreen('login');
  }, []);

  useEffect(() => {
    escala.value = withTiming(ZOOM_FINAL, {
      duration: restanteDaAproximacaoMs(),
      easing: Easing.linear,
    });
    // Um respiro antes da interface: a fotografia chega primeiro, sozinha, e
    // só então os controles se assentam sobre ela.
    uiOpacity.value = withDelay(
      450,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const estiloDaCamera = useAnimatedStyle(() => ({
    transform: [{ scale: escala.value }],
  }));

  const estiloDaInterface = useAnimatedStyle(() => ({
    opacity: uiOpacity.value,
    transform: [{ translateY: interpolate(uiOpacity.value, [0, 1], [16, 0]) }],
  }));

  return (
    <View style={styles.raiz}>
      {/*
        Sem fade na fotografia, de propósito: o `CitySplash` acabou de mostrá-la
        e ela já está decodificada. Entrar de zero mostraria o azul do fundo por
        um instante — um piscar onde hoje não há nenhum.
      */}
      <Animated.Image
        source={cidadeDaAbertura}
        style={[styles.cidade, estiloDaCamera]}
        resizeMode="cover"
      />

      <LinearGradient
        colors={SCRIM_SUPERIOR}
        style={[styles.scrimSuperior, { height: insets.top + 180 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={SCRIM_INFERIOR}
        locations={[0, 0.35, 0.75, 1]}
        style={styles.scrimInferior}
        pointerEvents="none"
      />

      <Animated.View style={[styles.camadaDaInterface, estiloDaInterface]}>
        <ScrollView
          contentContainerStyle={[
            styles.rolagem,
            { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
          ]}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.marca}>
            <Image
              source={require('../../assets/quibly-text.png')}
              style={styles.marcaImagem}
              resizeMode="contain"
            />
            <Glass scheme="dark" variant="chrome" cornerRadius={radius.full} style={styles.pilula}>
              <Text style={styles.tagline}>{t('tagline')}</Text>
            </Glass>
          </View>

          {/* O coelho da fotografia vive aqui: nada por cima dele. */}
          <View style={{ flex: 1 }} />

          <Glass scheme="dark" variant="surface" cornerRadius={28} style={styles.painel}>
            {message ? (
              <View style={styles.avisoBom}>
                <Text style={styles.avisoTexto}>{message}</Text>
              </View>
            ) : null}
            {error ? (
              <View style={styles.avisoRuim}>
                <Text style={styles.avisoTexto}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.chamada}>{t('login.socialSubtitle')}</Text>

            {/*
              Os dois botões não são de vidro, e não podem ser: o da Apple é uma
              view do sistema (`AppleAuthenticationButton`) e o do Google segue
              medidas e cores prescritas pelo guia deles. Alterar a superfície
              de qualquer um dos dois é motivo de reprovação na revisão. O vidro
              é o painel que os segura.
            */}
            <View style={styles.botoes}>
              <AppleSignInButton onError={setError} />
              <GoogleSignInButton onError={setError} />
            </View>

            <Text style={styles.legal}>{t('login.legal')}</Text>
          </Glass>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/**
 * Alfas de branco, não tokens: ver a nota sobre o §5.15 no topo do arquivo.
 * Cada número é o peso do bloco — 72% tagline, 62% chamada, 45% legal.
 */
const makeStyles = () => StyleSheet.create({
  // O azul só aparece enquanto o JPEG decodifica. `overflow: hidden` segura a
  // fotografia ampliada dentro da tela.
  raiz: { flex: 1, backgroundColor: AZUL_ABERTURA, overflow: 'hidden' },
  cidade: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },

  scrimSuperior: { position: 'absolute', top: 0, left: 0, right: 0 },
  scrimInferior: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%' },

  camadaDaInterface: { flex: 1 },
  rolagem: { flexGrow: 1, paddingHorizontal: space.xl },

  marca: { alignItems: 'center' },
  marcaImagem: {
    width: MARCA.largura,
    height: MARCA.altura,
    tintColor: '#FFFFFF',
    marginBottom: space.md,
  },
  pilula: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  tagline: {
    ...ty.caption,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  painel: {
    padding: space.lg,
    // A borda clara é o que faz o vidro ler como vidro sobre foto: sem ela o
    // painel vira uma mancha escura sem limite.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  chamada: {
    ...ty.caption,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    marginBottom: space.md,
  },
  botoes: { gap: space.md },
  avisoBom: {
    backgroundColor: 'rgba(74,222,128,0.92)',
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  avisoRuim: {
    backgroundColor: 'rgba(255,90,90,0.92)',
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  avisoTexto: { ...ty.caption, color: '#FFFFFF', textAlign: 'center' },
  legal: {
    ...ty.caption,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: space.lg,
  },
});
