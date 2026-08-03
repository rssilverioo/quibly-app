import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme, type Palette, radius, space, text } from '../../theme';

type OptionState = 'default' | 'selected' | 'correct' | 'incorrect';

interface QuizOptionProps {
  label: string;
  text: string;
  state: OptionState;
  onPress: () => void;
  disabled?: boolean;
}

type StateColors = { bg: string; border: string; text: string; labelBg: string };

const stateColors = (c: Palette): Record<OptionState, StateColors> => ({
  default: { bg: c.surface, border: c.border, text: c.fg, labelBg: c.surfaceRaised },
  selected: { bg: c.accentSoft, border: c.accent, text: c.accent, labelBg: c.accent },
  correct: { bg: c.surfaceRaised, border: c.success, text: c.success, labelBg: c.success },
  incorrect: { bg: c.surfaceRaised, border: c.danger, text: c.danger, labelBg: c.danger },
});

export default function QuizOption({ label, text: body, state, onPress, disabled }: QuizOptionProps) {
  const { c } = useTheme();
  const s = useMemo(() => stateColors(c)[state], [c, state]);
  const showIcon = state === 'correct' || state === 'incorrect';
  // O quadradinho da letra só ganha fundo colorido fora do estado neutro; é aí
  // que a letra passa a precisar de `fgOnAccent` em vez de `fgMuted`.
  const labelOnFill = state !== 'default';

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
          <Text style={[styles.labelText, { color: labelOnFill ? c.fgOnAccent : c.fgMuted }]}>{label}</Text>
        )}
      </View>
      <Text style={[styles.text, { color: s.text }]}>{body}</Text>
    </TouchableOpacity>
  );
}

// Sem cor aqui de propósito: toda a cor do componente é de estado e vive em
// `stateColors(c)`. Este bloco é só geometria, então não precisa do tema.
const styles = StyleSheet.create({
  option: {
    flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: radius.md,
    // `shadowColor: '#000'` é preto de sombra, não cor de interface — não existe
    // token para isso e não deve existir. A sombra em si é candidata a sair no
    // passe visual: a referência separa card do fundo só pelo fill.
    borderWidth: 2, marginBottom: 10, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  label: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  labelText: { ...text.bodyStrong, fontSize: 15 },
  text: { ...text.body, fontSize: 15, flex: 1, lineHeight: 22 },
});
