import React, { useRef, useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { staticDark as c } from '../../theme';

const { width, height } = Dimensions.get('window');

interface ConfettiOverlayProps {
  trigger: boolean;
  count?: number;
}

export default function ConfettiOverlay({ trigger, count = 150 }: ConfettiOverlayProps) {
  const confettiRef = useRef<ConfettiCannon>(null);

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
      colors={[c.gold, c.accent, c.accent, c.danger, c.warning, c.accent]}
    />
  );
}
