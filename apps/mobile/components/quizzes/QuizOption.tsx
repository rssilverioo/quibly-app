import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { FONTS } from '@quibly/shared/constants';
import { Check, X } from 'lucide-react-native';

type OptionState = 'default' | 'selected' | 'correct' | 'incorrect';

interface QuizOptionProps {
  label: string;
  text: string;
  state: OptionState;
  onPress: () => void;
  disabled?: boolean;
}

const STATE_COLORS: Record<OptionState, { bg: string; border: string; text: string; labelBg: string }> = {
  default: { bg: '#FFFFFF', border: '#E2E8F0', text: '#1A2E4A', labelBg: '#F1F5F9' },
  selected: { bg: '#DBEAFE', border: '#1E40AF', text: '#1E40AF', labelBg: '#1E40AF' },
  correct: { bg: '#D1FAE5', border: '#059669', text: '#059669', labelBg: '#059669' },
  incorrect: { bg: '#FEE2E2', border: '#DC2626', text: '#DC2626', labelBg: '#DC2626' },
};

export default function QuizOption({ label, text, state, onPress, disabled }: QuizOptionProps) {
  const c = STATE_COLORS[state];
  const showIcon = state === 'correct' || state === 'incorrect';
  const labelIsWhite = state !== 'default';

  return (
    <TouchableOpacity
      style={[styles.option, { backgroundColor: c.bg, borderColor: c.border }]}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.label, { backgroundColor: c.labelBg }]}>
        {showIcon ? (
          state === 'correct'
            ? <Check size={16} color="#FFFFFF" />
            : <X size={16} color="#FFFFFF" />
        ) : (
          <Text style={[styles.labelText, { color: labelIsWhite ? '#FFFFFF' : '#4A6580' }]}>{label}</Text>
        )}
      </View>
      <Text style={[styles.text, { color: c.text }]}>{text}</Text>
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
