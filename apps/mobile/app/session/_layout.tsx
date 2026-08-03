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
      {/*
        `fade`, não `slide_from_right`: a tela pós-timer não é a página
        seguinte, é o timer **virando** o card do post (`FLUXO §7.2`). Um
        deslize lateral leria como mais uma etapa.

        `gestureEnabled: false` porque `active` sai por `replace` e quem fica
        embaixo na pilha é `setup` — arrastar de volta cairia na tela de
        começar sessão, logo depois de encerrar uma. A saída é o `×`.
      */}
      <Stack.Screen
        name="published"
        options={{ animation: 'fade', gestureEnabled: false }}
      />
    </Stack>
  );
}
