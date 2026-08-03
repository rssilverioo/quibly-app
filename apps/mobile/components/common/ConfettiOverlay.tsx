import React, { useRef, useEffect, useMemo } from 'react';
import { Dimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTheme, BRAND_BLUE } from '../../theme';

const { width } = Dimensions.get('window');

interface ConfettiOverlayProps {
  trigger: boolean;
  count?: number;
}

export default function ConfettiOverlay({ trigger, count = 150 }: ConfettiOverlayProps) {
  const { c } = useTheme();
  const confettiRef = useRef<ConfettiCannon>(null);

  // Papel picado é ilustração, mas cai por cima da tela — então a lista vem da
  // paleta ativa para não sumir no fundo claro. `gold` saiu: é token deprecado
  // com o pódio. A azure de marca entra no lugar dele porque aqui nenhum texto
  // se apoia na cor, que é exatamente a condição de uso de `BRAND_BLUE`.
  // O accent aparece três vezes de propósito: é ele que dá a cor da celebração.
  const colors = useMemo(
    () => [BRAND_BLUE, c.accent, c.accent, c.danger, c.warning, c.accent],
    [c],
  );

  useEffect(() => {
    if (trigger) {
      confettiRef.current?.start();
    }
  }, [trigger]);

  if (!trigger) return null;

  return (
    <ConfettiCannon
      ref={confettiRef}
      count={count}
      origin={{ x: width / 2, y: -20 }}
      autoStart
      fadeOut
      explosionSpeed={350}
      fallSpeed={3000}
      colors={colors}
    />
  );
}
