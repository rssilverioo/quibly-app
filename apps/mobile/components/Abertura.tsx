import { useEffect } from 'react';
import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AZUL_DA_MARCA, COELHO_DA_ABERTURA, COR_DA_ABERTURA } from '../lib/abertura';
import { space } from '../theme';

/** Quanto a saída demora. Longo o bastante para ler como corte suave. */
const SAIDA_MS = 520;

/** Onde o coelho termina dentro do PNG quadrado (medido na arte de 22/09). */
const PE_DO_COELHO = 0.687;

/** O wordmark, na proporção do PNG (152×61). */
const MARCA = { largura: 132, altura: 53 };

/**
 * A tela de abertura, entre o splash nativo e o app pronto.
 *
 * ## Por que ela existe, se já há um splash nativo
 *
 * O nativo desenha um coelho centralizado sobre uma cor, e só. Esta tela
 * continua exatamente daí — mesma cor, mesmo coelho, no mesmo lugar — e faz
 * as duas coisas que o nativo não sabe: o wordmark aparece embaixo, e a saída
 * é por opacidade sobre o app já montado, em vez de um corte seco.
 *
 * ## Por que o coelho está onde está
 *
 * O splash nativo mostra o PNG quadrado em `contain`, ou seja, ajustado à
 * largura da tela e centrado na altura. Desenhar o mesmo PNG com a largura da
 * tela e centrado reproduz a posição pixel a pixel — é o que faz a troca do
 * nativo para cá ser invisível. Qualquer outra medida faria o coelho pular.
 *
 * ## Por que ela tem tempo mínimo
 *
 * Quem manda embora é `aoSair`, e quem decide quando é o layout
 * (`ABERTURA_MINIMA_MS`). Resolver a sessão de quem já está logado leva
 * milissegundos; sem o mínimo, o wordmark nunca chegaria a aparecer.
 */
export default function Abertura({
  /** Vira `true` quando o app está pronto: começa a saída. */
  encerrando = false,
  /** Chamado quando a saída termina, para o pai desmontar esta tela. */
  aoSair,
}: {
  encerrando?: boolean;
  aoSair?: () => void;
}) {
  const { width } = useWindowDimensions();
  const opacidade = useSharedValue(1);
  const marca = useSharedValue(0);

  useEffect(() => {
    // O wordmark chega depois do coelho, e chega devagar: a marca se assina,
    // não pisca.
    marca.value = withDelay(
      350,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  useEffect(() => {
    if (!encerrando) return;
    opacidade.value = withTiming(
      0,
      { duration: SAIDA_MS, easing: Easing.inOut(Easing.cubic) },
      (terminou) => {
        // `runOnJS` porque o callback roda na thread da UI, e desmontar um
        // componente é trabalho de React.
        if (terminou && aoSair) runOnJS(aoSair)();
      },
    );
  }, [encerrando]);

  const estiloDaTela = useAnimatedStyle(() => ({ opacity: opacidade.value }));
  const estiloDaMarca = useAnimatedStyle(() => ({
    opacity: marca.value,
    transform: [{ translateY: (1 - marca.value) * 8 }],
  }));

  return (
    <Animated.View style={[styles.tela, estiloDaTela]} pointerEvents="none">
      <Image
        source={COELHO_DA_ABERTURA}
        style={{ width, height: width }}
        resizeMode="contain"
      />
      {/*
        Logo abaixo dos pés do coelho, não do quadrado: o PNG tem muito ar em
        volta, e o coelho termina a 70% da altura dele (`PE_DO_COELHO`). Medir
        pelo quadrado deixava o wordmark perdido no terço de baixo da tela.
      */}
      <Animated.Image
        source={require('../assets/quibly-text.png')}
        style={[
          styles.marca,
          { top: '50%', marginTop: width * (PE_DO_COELHO - 0.5) + space.lg },
          estiloDaMarca,
        ]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // `absoluteFill` e não `flex: 1`: esta tela cobre o que estiver montado
  // embaixo, e não disputa espaço com ele.
  tela: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COR_DA_ABERTURA,
    alignItems: 'center',
    justifyContent: 'center',
    // Acima de tudo: durante a saída, o app já está montado por baixo.
    zIndex: 100,
  },
  marca: {
    position: 'absolute',
    width: MARCA.largura,
    height: MARCA.altura,
    tintColor: AZUL_DA_MARCA,
  },
});
