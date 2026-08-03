import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export default function FlashcardsLayout() {
  const { c } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
