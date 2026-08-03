import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme, type Palette, radius, space, text } from '../../theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Label displayed above the input */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Current input value */
  value: string;
  /** Change handler */
  onChangeText: (text: string) => void;
  /** Whether to obscure text (password fields) */
  secureTextEntry?: boolean;
  /** Error message to display below the input */
  error?: string;
  /** Prefix text rendered inside the input (e.g. "@" for handles) */
  prefix?: string;
  /** Keyboard type */
  keyboardType?: TextInputProps['keyboardType'];
  /** Auto-capitalize behaviour */
  autoCapitalize?: TextInputProps['autoCapitalize'];
  /** Hint text shown below the input (lighter than error) */
  hint?: string;
  /** Additional style for the outer container */
  containerStyle?: ViewStyle;
}

export default function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  error,
  prefix,
  keyboardType,
  autoCapitalize = 'none',
  hint,
  containerStyle,
  ...rest
}: InputProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [isFocused, setIsFocused] = useState(false);

  // Quando a borda é a única coisa que marca o estado do controle, ela precisa
  // de 3:1 (WCAG 1.4.11) — daí `borderStrong` no repouso, e não `border`, que é
  // hairline decorativa.
  const borderColor = error
    ? c.danger
    : isFocused
      ? c.accent
      : c.borderStrong;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.inputWrapper, { borderColor }]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}

        <TextInput
          style={[styles.input, prefix ? styles.inputWithPrefix : null]}
          placeholder={placeholder}
          // Placeholder é texto que precisa ser lido antes de digitar: `fgMuted`,
          // não `fgSubtle`.
          placeholderTextColor={c.fgMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          selectionColor={c.accent}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    marginBottom: space.lg,
  },
  label: {
    ...text.label,
    color: c.fgMuted,
    marginBottom: space.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  prefix: {
    ...text.body,
    color: c.fgMuted,
    marginRight: 2,
  },
  // Sem `lineHeight` de propósito: em `TextInput` no Android ele briga com o
  // padding vertical e corta a linha. Só tamanho e família vêm do degrau.
  input: {
    flex: 1,
    fontSize: text.body.fontSize,
    fontFamily: text.body.fontFamily,
    color: c.fg,
    paddingVertical: 14,
  },
  inputWithPrefix: {
    paddingLeft: 0,
  },
  errorText: {
    ...text.caption,
    color: c.danger,
    marginTop: 6,
    marginLeft: space.xs,
  },
  hintText: {
    ...text.caption,
    color: c.fgMuted,
    marginTop: 6,
    marginLeft: space.xs,
  },
});
