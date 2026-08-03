import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, type Palette, radius, space, text } from '../../theme';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({ icon, title, message, ctaLabel, onCta }: EmptyStateProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

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

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xxl },
  iconWrapper: { marginBottom: space.lg },
  // 18px não existe na escala; `title3` (20) é o degrau de título de seção.
  title: { ...text.title3, color: c.fg, textAlign: 'center', marginBottom: space.sm },
  // Mensagem de estado vazio é texto para ler, não detalhe desabilitado:
  // `fgMuted`. O mapa antigo já apontava certo aqui; o que muda é passar a
  // reagir à troca de tema em vez de ler uma cópia congelada da paleta.
  message: { ...text.label, color: c.fgMuted, textAlign: 'center', marginBottom: 20 },
  cta: { backgroundColor: c.accent, paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.md },
  ctaText: { ...text.label, fontFamily: text.bodyStrong.fontFamily, color: c.fgOnAccent },
});
