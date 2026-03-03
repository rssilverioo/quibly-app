import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { COLORS, FONTS } from '@quibly/shared/constants';

type OptionState = 'default' | 'selected' | 'correct' | 'incorrect';

interface QuizOptionProps {
  label: string;
  text: string;
  state: OptionState;
  onPress: () => void;
  disabled?: boolean;
}

const LABELS = ['A', 'B', 'C', 'D'];

const STATE_COLORS: Record<OptionState, { bg: string; border: string; text: string }> = {
  default: { bg: COLORS.surface, border: COLORS.border, text: COLORS.text },
  selected: { bg: COLORS.primary + '22', border: COLORS.primary, text: COLORS.text },
  correct: { bg: COLORS.success + '22', border: COLORS.success, text: COLORS.success },
  incorrect: { bg: COLORS.error + '22', border: COLORS.error, text: COLORS.error },
};

export default function QuizOption({ label, text, state, onPress, disabled }: QuizOptionProps) {
  const colors = STATE_COLORS[state];

  return (
    <TouchableOpacity
      style={[styles.option, { backgroundColor: colors.bg, borderColor: colors.border }]}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.label, { borderColor: colors.border }]}>
        <Text style={[styles.labelText, { color: colors.text }]}>{label}</Text>
      </View>
      <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14,
    borderWidth: 1.5, marginBottom: 10,
  },
  label: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  labelText: { fontSize: 15, fontFamily: FONTS.bold },
  text: { fontSize: 15, fontFamily: FONTS.medium, flex: 1, lineHeight: 22 },
});
