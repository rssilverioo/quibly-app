import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { roomCoverThumbForId, ROOM_ROW_THUMB } from '../../assets/room-covers';
import { MascotBlock } from '../../components/mascot';
import Press from '../../components/ui/Press';
import { getMyRooms, type RoomSummary } from '../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../theme';
import { useTabBarClearance } from './_layout';

export default function RoomsScreen() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tabClearance = useTabBarClearance();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setRooms(await getMyRooms()), []);
  useFocusEffect(useCallback(() => {
    let alive = true;
    void load().catch(() => {}).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };
  const join = () => {
    const normalized = code.trim();
    if (normalized) router.push(`/league/join/${encodeURIComponent(normalized)}`);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;

  if (rooms.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <MascotBlock state="wave" size={150} />
          <Text style={styles.emptyTitle}>{t('rooms.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('rooms.emptySubtitle')}</Text>
          <Press haptic="medium" onPress={() => router.push('/league/create')} style={styles.createButton}>
            <Plus size={18} color={c.fgOnAccent} />
            <Text style={styles.createText}>{t('rooms.create')}</Text>
          </Press>
          <View style={styles.joinRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              onSubmitEditing={join}
              autoCapitalize="characters"
              placeholder={t('rooms.code')}
              placeholderTextColor={c.fgSubtle}
              style={styles.input}
            />
            <Press onPress={join} style={styles.joinButton}><Text style={styles.joinText}>{t('rooms.join')}</Text></Press>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={rooms}
        keyExtractor={(room) => room.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.fgMuted} />}
        contentContainerStyle={[styles.list, { paddingBottom: tabClearance }]}
        ListHeaderComponent={<Text style={styles.title}>{t('rooms.listTitle')}</Text>}
        renderItem={({ item }) => (
          <Press onPress={() => router.push(`/league/room/${item.id}`)} style={styles.roomRow}>
            <Image
              source={item.cover_url ? { uri: item.cover_url } : roomCoverThumbForId(item.id)}
              style={styles.cover}
              resizeMode="cover"
            />
            <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
            <ChevronRight size={18} color={c.fgSubtle} />
          </Press>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
  list: { paddingHorizontal: space.xl, paddingTop: space.md },
  title: { ...text.title1, color: c.fg, marginBottom: space.xl },
  roomRow: { height: 72, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  // A banner, not an avatar: 16:9 like the room hero it previews. Square-cropping
  // the cover turned the artwork into a sticker and cut the rabbit off-centre.
  cover: { ...ROOM_ROW_THUMB, borderRadius: radius.sm, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  roomName: { ...text.bodyStrong, color: c.fg, flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.xl, paddingBottom: 80 },
  emptyTitle: { ...text.title2, color: c.fg, marginBottom: space.sm },
  emptySubtitle: { ...text.body, color: c.fgMuted, textAlign: 'center', lineHeight: 22 },
  createButton: { marginTop: space.xl, height: 52, width: '100%', borderRadius: radius.lg, backgroundColor: c.accent, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center' },
  createText: { ...text.bodyStrong, color: c.fgOnAccent },
  joinRow: { flexDirection: 'row', gap: space.sm, width: '100%', marginTop: space.md },
  input: { flex: 1, height: 50, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: space.lg, color: c.fg, backgroundColor: c.surface, ...text.body },
  joinButton: { height: 50, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  joinText: { ...text.label, color: c.fg },
});
