import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export default function LeagueLayout() {
  // `useTheme()` e não `legacyColors`: o fundo da pilha é o que aparece durante
  // a transição entre telas, e com a constante congelada ele ficava claro
  // depois de o usuário trocar para o escuro.
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="create" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="feed/post/[id]" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="room/[id]" />
      <Stack.Screen name="details/[id]" />
      <Stack.Screen name="challenge/[id]" />
      <Stack.Screen name="challenge/new" />
      <Stack.Screen name="challenge/[id]/member/[userId]" />
      <Stack.Screen name="join/[code]" />
    </Stack>
  );
}
