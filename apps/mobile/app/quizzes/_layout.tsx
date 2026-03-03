import { Stack } from 'expo-router';
import { COLORS } from '@quibly/shared/constants';

export default function QuizzesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
