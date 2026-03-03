import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Dimensions, Image, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@quibly/shared/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = CARD_WIDTH * 0.85;

interface FlashcardCardProps {
  front: string;
  back: string;
  explain?: string;
  imageUrl?: string | null;
  onFlip?: () => void;
}

export default function FlashcardCard({ front, back, explain, imageUrl, onFlip }: FlashcardCardProps) {
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
      {/* Front */}
      <Animated.View style={[styles.card, styles.frontCard, frontStyle]}>
        <Text style={styles.label}>FRONT</Text>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : null}
        <Text style={[styles.text, imageUrl ? styles.textWithImage : null]}>{front}</Text>
      </Animated.View>

      {/* Back */}
      <Animated.View style={[styles.card, styles.backCard, backStyle]}>
        <Text style={styles.label}>BACK</Text>
        <Text style={styles.text}>{back}</Text>
        {explain ? (
          <View style={styles.explainContainer}>
            <Text style={styles.explainText}>{explain}</Text>
          </View>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { width: CARD_WIDTH, height: CARD_HEIGHT, alignSelf: 'center' },
  card: {
    position: 'absolute', width: '100%', height: '100%',
    borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, overflow: 'hidden',
  },
  frontCard: { backgroundColor: COLORS.surface, borderColor: COLORS.primary + '40' },
  backCard: { backgroundColor: COLORS.surfaceLight, borderColor: COLORS.secondary + '40' },
  label: { position: 'absolute', top: 16, left: 20, fontSize: 11, fontFamily: FONTS.semiBold, color: COLORS.textMuted, letterSpacing: 1, zIndex: 1 },
  text: { fontSize: 18, fontFamily: FONTS.medium, color: COLORS.text, textAlign: 'center', lineHeight: 26 },
  textWithImage: { fontSize: 16, marginTop: 8 },
  cardImage: {
    width: CARD_WIDTH - 80,
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
  },
  explainContainer: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 10,
    padding: 10,
  },
  explainText: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 16 },
});
