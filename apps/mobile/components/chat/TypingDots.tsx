import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const TAMANHO = 5;
const CICLO_MS = 1200;

/**
 * Os três pontinhos de "está digitando".
 *
 * Cada ponto corre o mesmo ciclo, defasado de um terço — é a defasagem que
 * produz a onda; três animações iguais só piscariam juntas.
 *
 * `useNativeDriver` porque isto anima para sempre enquanto alguém digita. Na
 * ponte do JS, a onda engasgaria toda vez que a lista de mensagens
 * redesenhasse, que é exatamente quando ela está na tela.
 */
export default function TypingDots({ color }: { color: string }) {
  const pontos = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animacoes = pontos.map((valor, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((CICLO_MS / 3) * i),
          Animated.timing(valor, {
            toValue: 1,
            duration: CICLO_MS / 3,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(valor, {
            toValue: 0,
            duration: CICLO_MS / 3,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          // Completa o ciclo para os três voltarem em fase — sem isto a
          // defasagem escorrega a cada volta e a onda vira ruído.
          Animated.delay(CICLO_MS - (CICLO_MS / 3) * (i + 2)),
        ]),
      ),
    );

    animacoes.forEach((a) => a.start());
    return () => animacoes.forEach((a) => a.stop());
  }, [pontos]);

  return (
    <View style={styles.linha}>
      {pontos.map((valor, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ponto,
            {
              backgroundColor: color,
              opacity: valor.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{
                translateY: valor.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
              }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ponto: { width: TAMANHO, height: TAMANHO, borderRadius: TAMANHO / 2 },
});
