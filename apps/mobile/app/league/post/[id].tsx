import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ImageIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

import Press from '../../../components/ui/Press';
import { createRoomPost, type PostPhotoFile } from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';

export default function RoomPhotoPostScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [photo, setPhoto] = useState<PostPhotoFile | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const adopt = (asset: ImagePicker.ImagePickerAsset) => setPhoto({
    uri: asset.uri,
    name: asset.fileName || 'estudo.jpg',
    type: asset.mimeType || 'image/jpeg',
  });

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.82 });
    if (!result.canceled && result.assets[0]) adopt(result.assets[0]);
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82 });
    if (!result.canceled && result.assets[0]) adopt(result.assets[0]);
  };

  const publish = async () => {
    if (!photo || !roomId || submitting) return;
    setSubmitting(true);
    try {
      await createRoomPost(roomId, photo, caption);
      router.back();
    } catch (error: any) {
      Alert.alert(t('error'), error?.message ?? t('error'));
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Press onPress={() => router.back()} style={styles.close}><X size={22} color={c.fgMuted} /></Press>
        <Text style={styles.title}>{t('rooms.newPost')}</Text>
        <View style={styles.close} />
      </View>

      <View style={styles.body}>
        {photo ? (
          <Press onPress={choosePhoto} style={styles.previewWrap}>
            <Image source={{ uri: photo.uri }} style={styles.preview} />
          </Press>
        ) : (
          <View style={styles.photoActions}>
            <Press onPress={takePhoto} style={styles.photoChoice}>
              <Camera size={24} color={c.fg} />
              <Text style={styles.choiceText}>{t('rooms.takePhoto')}</Text>
            </Press>
            <Press onPress={choosePhoto} style={styles.photoChoice}>
              <ImageIcon size={24} color={c.fg} />
              <Text style={styles.choiceText}>{t('rooms.choosePhoto')}</Text>
            </Press>
          </View>
        )}

        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={t('rooms.captionPlaceholder')}
          placeholderTextColor={c.fgSubtle}
          multiline
          maxLength={280}
          style={styles.caption}
        />
      </View>

      <Press onPress={publish} disabled={!photo || submitting} style={[styles.publish, (!photo || submitting) && styles.disabled]}>
        {submitting ? <ActivityIndicator color={c.fgOnAccent} /> : <Text style={styles.publishText}>{t('rooms.publishPhoto')}</Text>}
      </Press>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { height: 56, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...text.bodyStrong, color: c.fg },
  body: { flex: 1, padding: space.xl, gap: space.lg },
  photoActions: { flexDirection: 'row', gap: space.md },
  photoChoice: { flex: 1, aspectRatio: 1, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: space.md },
  choiceText: { ...text.label, color: c.fg },
  previewWrap: { overflow: 'hidden', borderRadius: radius.lg },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  caption: { minHeight: 84, borderBottomWidth: 1, borderBottomColor: c.border, color: c.fg, ...text.body, textAlignVertical: 'top', paddingVertical: space.md },
  publish: { height: 54, margin: space.xl, borderRadius: radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  publishText: { ...text.bodyStrong, color: c.fgOnAccent },
});
