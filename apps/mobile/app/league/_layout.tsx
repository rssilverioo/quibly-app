import { Stack } from 'expo-router';
import { COLORS } from '@quibly/shared/constants';

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
      <Stack.Screen name="join/[code]" />
    </Stack>
  );
}
