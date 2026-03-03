import { Stack } from 'expo-router';
import { COLORS } from '@quibly/shared/constants';

export default function FlashcardsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
