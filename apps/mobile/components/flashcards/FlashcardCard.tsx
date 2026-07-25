import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Dimensions, Image, View, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@quibly/shared/constants';
import { Lightbulb, Brain } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { staticDark as c } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = CARD_WIDTH * 0.85;

interface FlashcardCardProps {
  front: string;
  back: string;
  // Nullable, not just optional: these come straight off the API, where an
  // absent value is null rather than undefined.
  explain?: string | null;
  imageUrl?: string | null;
  onFlip?: () => void;
}

export default function FlashcardCard({ front, back, explain, imageUrl, onFlip }: FlashcardCardProps) {
  const { t } = useTranslation('flashcards');
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
              <ActivityIndicator color={c.accent} size="small" />
            ) : aiExplain ? (
              <>
                <View style={styles.aiSection}>
                  <Lightbulb size={16} color={c.warning} />
                  <Text style={styles.aiSectionTitle}>{t('simpleExplanation')}</Text>
                </View>
                <Text style={styles.aiText}>{aiExplain.simple}</Text>
                <View style={[styles.aiSection, { marginTop: 12 }]}>
                  <Brain size={16} color={c.accent} />
                  <Text style={styles.aiSectionTitle}>{t('memoryTrick')}</Text>
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
          <Lightbulb size={14} color={showExplain ? c.fgOnAccent : c.warning} />
          <Text style={[styles.explainBtnText, showExplain && { color: c.fg }]}>
            {showExplain ? t('showAnswer') : t('explain')}
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
  frontCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.accentSoft, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  backCard: { backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  label: { position: 'absolute', top: 16, left: 20, fontSize: 11, fontFamily: FONTS.semiBold, color: c.fgSubtle, letterSpacing: 1, zIndex: 1 },
  text: { fontSize: 18, fontFamily: FONTS.medium, color: c.fg, textAlign: 'center', lineHeight: 26 },
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
    backgroundColor: c.accentSoft,
    borderRadius: 10,
    padding: 10,
  },
  explainText: { fontSize: 12, fontFamily: FONTS.regular, color: c.fgMuted, textAlign: 'center', lineHeight: 16 },

  // AI Explain
  aiExplainWrap: { width: '100%', alignItems: 'flex-start', paddingTop: 8 },
  aiSection: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  aiSectionTitle: { fontSize: 13, fontFamily: FONTS.bold, color: c.fg },
  aiText: { fontSize: 14, fontFamily: FONTS.regular, color: c.fgMuted, lineHeight: 20 },

  // Explain button
  explainBtn: {
    position: 'absolute', top: 12, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.surfaceRaised, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  explainBtnActive: { backgroundColor: c.warning },
  explainBtnText: { fontSize: 12, fontFamily: FONTS.semiBold, color: c.warning },
});
