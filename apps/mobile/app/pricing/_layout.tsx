import { Stack } from 'expo-router';
import { legacyColors as COLORS } from '../../theme';

export default function PricingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
