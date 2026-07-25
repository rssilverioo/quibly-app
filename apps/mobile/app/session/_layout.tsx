import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export default function SessionLayout() {
  const { c } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="setup" />
      <Stack.Screen name="active" />
    </Stack>
  );
}
