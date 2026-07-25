import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { FONTS } from '@quibly/shared/constants';
import { Check, X } from 'lucide-react-native';
import { staticDark as c } from '../../theme';

type OptionState = 'default' | 'selected' | 'correct' | 'incorrect';

interface QuizOptionProps {
  label: string;
  text: string;
  state: OptionState;
  onPress: () => void;
  disabled?: boolean;
}

const STATE_COLORS: Record<OptionState, { bg: string; border: string; text: string; labelBg: string }> = {
  default: { bg: c.surface, border: c.border, text: c.fg, labelBg: c.surfaceRaised },
  selected: { bg: c.accentSoft, border: c.accent, text: c.accent, labelBg: c.accent },
  correct: { bg: c.surfaceRaised, border: c.success, text: c.success, labelBg: c.success },
  incorrect: { bg: c.surfaceRaised, border: c.danger, text: c.danger, labelBg: c.danger },
};

export default function QuizOption({ label, text, state, onPress, disabled }: QuizOptionProps) {
  const s = STATE_COLORS[state];
  const showIcon = state === 'correct' || state === 'incorrect';
  const labelIsWhite = state !== 'default';

  return (
    <TouchableOpacity
      style={[styles.option, { backgroundColor: s.bg, borderColor: s.border }]}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.label, { backgroundColor: s.labelBg }]}>
        {showIcon ? (
          state === 'correct'
            ? <Check size={16} color={c.fgOnAccent} />
            : <X size={16} color={c.fgOnAccent} />
        ) : (
          <Text style={[styles.labelText, { color: labelIsWhite ? c.fgOnAccent : c.fgMuted }]}>{label}</Text>
        )}
      </View>
      <Text style={[styles.text, { color: s.text }]}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16,
    borderWidth: 2, marginBottom: 10, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  label: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  labelText: { fontSize: 15, fontFamily: FONTS.bold },
  text: { fontSize: 15, fontFamily: FONTS.medium, flex: 1, lineHeight: 22 },
});
