import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ImageIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

import Press from '../../../components/ui/Press';
import { createRoomPost, type PostPhotoFile } from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';

/** Retrato máximo: 3/4. Acima disso a foto some com o resto da tela. */
const PORTRAIT_LIMIT = 3 / 4;

export default function RoomPhotoPostScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [photo, setPhoto] = useState<PostPhotoFile | null>(null);
  // A proporção real da foto escolhida. Teto de 3/4 (retrato máximo) para uma
  // foto muito alta não empurrar a legenda e o botão para fora da tela.
  const [ratio, setRatio] = useState(PORTRAIT_LIMIT);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adopt = (asset: ImagePicker.ImagePickerAsset) => {
    setPhoto({
      uri: asset.uri,
      name: asset.fileName || 'estudo.jpg',
      type: asset.mimeType || 'image/jpeg',
    });
    // A prova não pode ser recortada: mostra-se a foto inteira, na proporção
    // que ela tem. Antes era `4/3` fixo com `cover`, que cortava.
    const natural = asset.width && asset.height ? asset.width / asset.height : PORTRAIT_LIMIT;
    setRatio(Math.max(PORTRAIT_LIMIT, natural));
  };

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
    setError(null);
    try {
      await createRoomPost(roomId, photo, caption);
      router.back();
    } catch (err) {
      // A foto NÃO se perde: ela continua no estado e o botão vira "Tentar de
      // novo". Um `Alert.alert` aqui já custou o post de alguém.
      setError((err as Error)?.message ?? t('rooms.postError'));
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
          <View style={styles.previewWrap}>
            <Press onPress={choosePhoto}>
              <Image source={{ uri: photo.uri }} style={[styles.preview, { aspectRatio: ratio }]} />
            </Press>
            <Press onPress={() => setPhoto(null)} style={styles.removePhoto}>
              <X size={18} color={c.fg} />
            </Press>
          </View>
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

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Press onPress={publish} disabled={!photo || submitting} style={[styles.publish, (!photo || submitting) && styles.disabled]}>
        {submitting
          ? <ActivityIndicator color={c.fgOnAccent} />
          : <Text style={styles.publishText}>{t(error ? 'rooms.tryAgain' : 'rooms.publishPhoto')}</Text>}
      </Press>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { height: 56, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...text.bodyStrong, color: c.fg },
  body: { flex: 1, padding: space.lg, gap: space.lg },
  photoActions: { flexDirection: 'row', gap: space.md },
  photoChoice: { flex: 1, aspectRatio: 1, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: space.md },
  choiceText: { ...text.label, color: c.fg },
  previewWrap: { borderRadius: radius.lg, overflow: 'hidden' },
  removePhoto: { position: 'absolute', top: space.sm, right: space.sm, width: 28, height: 28, borderRadius: radius.full, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', borderRadius: radius.lg, backgroundColor: c.skeleton },
  caption: { minHeight: 84, borderBottomWidth: 1, borderBottomColor: c.border, color: c.fg, ...text.body, textAlignVertical: 'top', paddingVertical: space.md },
  publish: { height: 54, margin: space.lg, borderRadius: radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  publishText: { ...text.bodyStrong, color: c.fgOnAccent },
  error: { ...text.caption, color: c.danger, marginHorizontal: space.lg },
});
