import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  AZUL_ABERTURA,
  ZOOM_FINAL,
  cidadeDaAbertura,
  escalaDaAproximacao,
  restanteDaAproximacaoMs,
} from '../lib/abertura';

/**
 * A tela de abertura, entre o splash nativo e o app pronto.
 *
 * ## Por que ela existe, se já há um splash nativo
 *
 * O splash nativo do Expo desenha **um logo centralizado sobre uma cor** — é o
 * que a storyboard do iOS e o `splashscreen_logo` do Android sabem fazer. Ele
 * não sabe preencher a tela com uma fotografia, e forçá-lo a isso exigiria
 * mexer na storyboard e ainda quebraria em proporções diferentes.
 *
 * Aqui, em React, `resizeMode="cover"` resolve em qualquer aparelho.
 *
 * ## Por que ela não decide mais nada
 *
 * A cidade e a curva de aproximação vieram para `lib/abertura`. Esta tela e a
 * de login mostram a mesma fotografia no mesmo ponto do zoom, e nenhuma das
 * duas é dona dessa escolha — se fosse, a troca de uma para a outra trocaria
 * de cidade ou daria um salto na escala. Ver a nota em `INICIO_DA_ABERTURA`.
 */
export default function CitySplash() {
  // Começa onde o relógio da abertura estiver, não em zero: se esta tela
  // remontar (o `isLoading` oscila em rede ruim), a câmera continua de onde
  // parou em vez de recuar.
  const escala = useSharedValue(escalaDaAproximacao());

  useEffect(() => {
    escala.value = withTiming(ZOOM_FINAL, {
      duration: restanteDaAproximacaoMs(),
      // Linear porque a curva atravessa duas telas: qualquer aceleração faria
      // a velocidade saltar no quadro em que o login assume a animação.
      easing: Easing.linear,
    });
  }, []);

  const estiloDaCamera = useAnimatedStyle(() => ({
    transform: [{ scale: escala.value }],
  }));

  return (
    <View style={styles.tela}>
      <Animated.Image
        source={cidadeDaAbertura}
        style={[styles.arte, estiloDaCamera]}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // `absoluteFill` e não `flex: 1`: esta tela cobre o que estiver montado
  // embaixo, e não disputa espaço com ele. `overflow: hidden` segura a imagem
  // ampliada dentro dos limites da tela.
  tela: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AZUL_ABERTURA,
    overflow: 'hidden',
  },
  arte: { width: '100%', height: '100%' },
});
