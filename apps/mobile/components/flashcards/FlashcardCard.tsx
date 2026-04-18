import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Dimensions, Image, View, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@quibly/shared/constants';
import { Lightbulb, Brain } from 'lucide-react-native';
import { api } from '../../lib/api';

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
  const [aiExplain, setAiExplain] = useState<{ simple: string; mnemonic: string } | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
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
    if (!newFlipped) setShowExplain(false);
  };

  const handleExplain = async () => {
    if (aiExplain) {
      setShowExplain(!showExplain);
      return;
    }
    setLoadingExplain(true);
    setShowExplain(true);
    try {
      const result = await api.post<{ simple: string; mnemonic: string }>('/generate/explain', {
        front,
        back,
        explain,
      });
      setAiExplain(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setShowExplain(false);
    }
    setLoadingExplain(false);
  };

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={handleFlip} style={styles.container}>
      {/* Front */}
      <Animated.View style={[styles.card, styles.frontCard, frontStyle]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : null}
        <Text style={[styles.text, imageUrl ? styles.textWithImage : null]}>{front}</Text>
      </Animated.View>

      {/* Back */}
      <Animated.View style={[styles.card, styles.backCard, backStyle]}>
        {!showExplain ? (
          <>
            <Text style={styles.text}>{back}</Text>
            {explain ? (
              <View style={styles.explainContainer}>
                <Text style={styles.explainText}>{explain}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.aiExplainWrap}>
            {loadingExplain ? (
              <ActivityIndicator color="#1E40AF" size="small" />
            ) : aiExplain ? (
              <>
                <View style={styles.aiSection}>
                  <Lightbulb size={16} color="#D97706" />
                  <Text style={styles.aiSectionTitle}>Simple explanation</Text>
                </View>
                <Text style={styles.aiText}>{aiExplain.simple}</Text>
                <View style={[styles.aiSection, { marginTop: 12 }]}>
                  <Brain size={16} color="#7C3AED" />
                  <Text style={styles.aiSectionTitle}>Memory trick</Text>
                </View>
                <Text style={styles.aiText}>{aiExplain.mnemonic}</Text>
              </>
            ) : null}
          </View>
        )}

        {/* Explain button */}
        <TouchableOpacity
          style={[styles.explainBtn, showExplain && styles.explainBtnActive]}
          onPress={(e) => { e.stopPropagation(); handleExplain(); }}
          activeOpacity={0.85}
          hitSlop={8}
        >
          <Lightbulb size={14} color={showExplain ? '#FFFFFF' : '#D97706'} />
          <Text style={[styles.explainBtnText, showExplain && { color: '#FFFFFF' }]}>
            {showExplain ? 'Show answer' : 'Explain'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { width: CARD_WIDTH, height: CARD_HEIGHT, alignSelf: 'center' },
  card: {
    position: 'absolute', width: '100%', height: '100%',
    borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  frontCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DBEAFE', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  backCard: { backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  label: { position: 'absolute', top: 16, left: 20, fontSize: 11, fontFamily: FONTS.semiBold, color: '#8BA3BC', letterSpacing: 1, zIndex: 1 },
  text: { fontSize: 18, fontFamily: FONTS.medium, color: '#1A2E4A', textAlign: 'center', lineHeight: 26 },
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
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    padding: 10,
  },
  explainText: { fontSize: 12, fontFamily: FONTS.regular, color: '#4A6580', textAlign: 'center', lineHeight: 16 },

  // AI Explain
  aiExplainWrap: { width: '100%', alignItems: 'flex-start', paddingTop: 8 },
  aiSection: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  aiSectionTitle: { fontSize: 13, fontFamily: FONTS.bold, color: '#1A2E4A' },
  aiText: { fontSize: 14, fontFamily: FONTS.regular, color: '#4A6580', lineHeight: 20 },

  // Explain button
  explainBtn: {
    position: 'absolute', top: 12, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  explainBtnActive: { backgroundColor: '#D97706' },
  explainBtnText: { fontSize: 12, fontFamily: FONTS.semiBold, color: '#D97706' },
});
