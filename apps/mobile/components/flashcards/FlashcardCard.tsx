import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@quibly/shared/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = CARD_WIDTH * 0.7;

interface FlashcardCardProps {
  front: string;
  back: string;
  onFlip?: () => void;
}

export default function FlashcardCard({ front, back, onFlip }: FlashcardCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const rotation = useSharedValue(0);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(rotation.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: 'hidden',
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(rotation.value, [0, 1], [180, 360])}deg` }],
    backfaceVisibility: 'hidden',
  }));

  const handleFlip = () => {
    const newFlipped = !isFlipped;
    setIsFlipped(newFlipped);
    rotation.value = withTiming(newFlipped ? 1 : 0, { duration: 400 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (newFlipped && onFlip) onFlip();
  };

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={handleFlip} style={styles.container}>
      <Animated.View style={[styles.card, styles.frontCard, frontStyle]}>
        <Text style={styles.label}>FRONT</Text>
        <Text style={styles.text}>{front}</Text>
      </Animated.View>
      <Animated.View style={[styles.card, styles.backCard, backStyle]}>
        <Text style={styles.label}>BACK</Text>
        <Text style={styles.text}>{back}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { width: CARD_WIDTH, height: CARD_HEIGHT, alignSelf: 'center' },
  card: {
    position: 'absolute', width: '100%', height: '100%',
    borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  frontCard: { backgroundColor: COLORS.surface, borderColor: COLORS.primary + '40' },
  backCard: { backgroundColor: COLORS.surfaceLight, borderColor: COLORS.secondary + '40' },
  label: { position: 'absolute', top: 16, left: 20, fontSize: 11, fontFamily: FONTS.semiBold, color: COLORS.textMuted, letterSpacing: 1 },
  text: { fontSize: 18, fontFamily: FONTS.medium, color: COLORS.text, textAlign: 'center', lineHeight: 26 },
});
