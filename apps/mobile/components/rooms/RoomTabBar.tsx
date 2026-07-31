import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart3, Info, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import Press from '../ui/Press';
import { useTheme, type Palette, space, text } from '../../theme';

type RoomTab = 'details' | 'rankings' | 'chat';

export default function RoomTabBar({
  roomId,
  challengeId,
  active,
}: {
  roomId: string;
  challengeId?: string | null;
  active?: RoomTab;
}) {
  const router = useRouter();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tabs = [
    { id: 'details' as const, label: 'Details', Icon: Info, onPress: () => router.push(`/league/details/${roomId}`) },
    { id: 'rankings' as const, label: 'Rankings', Icon: BarChart3, onPress: () => challengeId && router.push({ pathname: '/league/challenge/[id]', params: { id: challengeId, roomId } }), disabled: !challengeId },
    { id: 'chat' as const, label: 'Chat', Icon: MessageCircle, onPress: () => router.push({ pathname: '/league/chat/[id]', params: { id: roomId, challengeId: challengeId ?? '' } }) },
  ];
  return (
    <View style={styles.bar}>
      {tabs.map(({ id, label, Icon, onPress, disabled }) => {
        const selected = active === id;
        return (
          <Press key={id} onPress={onPress} disabled={disabled} style={[styles.tab, disabled && styles.disabled]}>
            <Icon size={20} color={selected ? c.accent : c.fgMuted} />
            <Text style={[styles.label, selected && styles.selected]}>{label}</Text>
          </Press>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  bar: { height: 66, flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg, paddingHorizontal: space.md },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { ...text.caption, color: c.fgMuted },
  selected: { color: c.accent },
  disabled: { opacity: 0.35 },
});
