import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

const COLORS = {
  background: '#0A0A0F',
  surface: '#141420',
  surfaceLight: '#1E1E2E',
  border: '#2A2A3E',
  primary: '#1E40AF',
  primaryLight: '#2B53D8',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  error: '#FF4757',
};

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
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? COLORS.error
    : isFocused
      ? COLORS.primary
      : COLORS.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.inputWrapper, { borderColor }]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}

        <TextInput
          style={[styles.input, prefix ? styles.inputWithPrefix : null]}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          selectionColor={COLORS.primaryLight}
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

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  prefix: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginRight: 2,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 14,
  },
  inputWithPrefix: {
    paddingLeft: 0,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  hintText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
});
