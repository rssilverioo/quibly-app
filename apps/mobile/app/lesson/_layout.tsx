import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export default function LessonLayout() {
  const { c } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      {/* Capture is a modal: it's a detour from the list, not a destination. */}
      <Stack.Screen name="capture" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
