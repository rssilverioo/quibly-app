import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Upload } from 'lucide-react-native';
import { COLORS, FONTS } from '@quibly/shared/constants';
import { useTranslation } from 'react-i18next';

interface UploadZoneProps {
  onPress: () => void;
}

export default function UploadZone({ onPress }: UploadZoneProps) {
  const { t } = useTranslation('documents');

  return (
    <TouchableOpacity style={styles.zone} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.iconCircle}>
        <Upload size={24} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>{t('upload')}</Text>
      <Text style={styles.subtitle}>{t('selectFile')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  zone: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
});
