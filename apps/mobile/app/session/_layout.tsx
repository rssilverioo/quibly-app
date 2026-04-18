import { Stack } from 'expo-router';
import { COLORS } from '@quibly/shared/constants';

export default function SessionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#EEF5FF' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="setup" />
      <Stack.Screen name="active" />
      <Stack.Screen name="audio" />
    </Stack>
  );
}
