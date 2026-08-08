import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  AZUL_ABERTURA,
  ZOOM_FINAL,
  cidadeDaAbertura,
  escalaDaAproximacao,
  restanteDaAproximacaoMs,
} from '../lib/abertura';

/** Quanto a saída demora. Longo o bastante para ler como corte suave. */
const SAIDA_MS = 620;

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
 * ## Por que ela tem tempo mínimo, contrariando o que eu escrevi aqui antes
 *
 * A primeira versão dizia: "nenhuma temporização artificial — ela dura
 * exatamente o que a espera durar". A regra é certa para tela de carregamento,
 * onde segurar a pessoa é desrespeito. Só que esta não é uma: é a abertura da
 * marca, e a espera que ela cobria — o Firebase resolver a sessão — leva
 * milissegundos para quem já está logado.
 *
 * O efeito prático era a fotografia **não aparecer**. Quem abria o app via o
 * coelho do splash nativo e caía direto na lista de salas; as três cidades só
 * existiam para quem estava deslogado, na tela de login. O dono do produto
 * relatou exatamente isso em 08/08.
 *
 * Então o tempo mínimo não é enfeite nem espera fabricada: é o que faz a tela
 * existir. Quem manda embora é `aoSair`, e quem decide quando é o layout —
 * aqui só mora a animação.
 *
 * ## Por que ela não decide mais nada
 *
 * A cidade e a curva de aproximação vieram para `lib/abertura`. Esta tela e a
 * de login mostram a mesma fotografia no mesmo ponto do zoom, e nenhuma das
 * duas é dona dessa escolha — se fosse, a troca de uma para a outra trocaria
 * de cidade ou daria um salto na escala. Ver a nota em `INICIO_DA_ABERTURA`.
 */
export default function CitySplash({
  /** Vira `true` quando o app está pronto: começa a saída. */
  encerrando = false,
  /** Chamado quando a saída termina, para o pai desmontar esta tela. */
  aoSair,
}: {
  encerrando?: boolean;
  aoSair?: () => void;
}) {
  // Começa onde o relógio da abertura estiver, não em zero: esta tela monta
  // duas vezes — uma enquanto a autenticação resolve, outra por cima do app já
  // montado — e a câmera precisa continuar de onde parou nas duas.
  const escala = useSharedValue(escalaDaAproximacao());
  const opacidade = useSharedValue(1);
  const marca = useSharedValue(0);

  useEffect(() => {
    escala.value = withTiming(ZOOM_FINAL, {
      duration: restanteDaAproximacaoMs(),
      // Linear porque a curva atravessa duas telas: qualquer aceleração faria
      // a velocidade saltar no quadro em que a outra assume a animação.
      easing: Easing.linear,
    });
    marca.value = withDelay(320, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
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
  const estiloDaCamera = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));
  const estiloDaMarca = useAnimatedStyle(() => ({ opacity: marca.value }));

  return (
    <Animated.View style={[styles.tela, estiloDaTela]} pointerEvents="none">
      <Animated.Image
        source={cidadeDaAbertura}
        style={[styles.arte, estiloDaCamera]}
        resizeMode="cover"
      />
      {/* Sem isto o logotipo branco cai em cima da calçada clara das fotos. */}
      <LinearGradient
        colors={['transparent', 'rgba(4,10,26,0.72)']}
        style={styles.pe}
      />
      <Animated.View style={[styles.marca, estiloDaMarca]}>
        <Image
          source={require('../assets/quibly-text.png')}
          style={styles.marcaImagem}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
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
    // Acima de tudo: durante a saída, o app já está montado por baixo.
    zIndex: 100,
  },
  arte: { width: '100%', height: '100%' },
  pe: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '32%' },
  marca: { position: 'absolute', left: 0, right: 0, bottom: '11%', alignItems: 'center' },
  marcaImagem: { width: 168, height: 46, tintColor: '#FFFFFF' },
});
