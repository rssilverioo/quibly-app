import { Stack } from 'expo-router';
import { legacyColors as COLORS } from '../../theme';

export default function LeagueLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="feed/[id]" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="challenge/[id]" />
      <Stack.Screen name="join/[code]" />
    </Stack>
  );
}
