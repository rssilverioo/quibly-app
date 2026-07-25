import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS } from '@quibly/shared/constants';
import { legacyColors as COLORS } from '../../theme';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({ icon, title, message, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {ctaLabel && onCta && (
        <TouchableOpacity style={styles.cta} activeOpacity={0.8} onPress={onCta}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  iconWrapper: { marginBottom: 16 },
  title: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text, textAlign: 'center', marginBottom: 8 },
  message: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  cta: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  ctaText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.onPrimary },
});
