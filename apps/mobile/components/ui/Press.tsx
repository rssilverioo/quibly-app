import { type ReactNode } from 'react';
import { Pressable, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { motion, PRESS_SCALE } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /**
   * Segurar. Usado para denunciar e bloquear conteúdo de outra pessoa.
   *
   * Fica aqui e não num `Pressable` avulso no ponto de uso porque toda
   * superfície tocável do app passa por este componente — e o toque longo
   * precisa dar o mesmo retorno tátil que o toque curto, ou parece que o app
   * travou. O háptico é `medium` de propósito: ele confirma que algo abriu.
   */
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Physical feedback on press. Off only for low-stakes taps. */
  haptic?: false | 'light' | 'medium';
  /** How far it compresses. Big surfaces should move less. */
  scale?: number;
  /**
   * Nome do botão para quem não vê o ícone.
   *
   * Obrigatório na prática em botão só de ícone: sem isto o VoiceOver anuncia
   * um alvo mudo, e a árvore de acessibilidade — que é como a captura de tela
   * dirige o app — não tem por onde encontrá-lo.
   */
  accessibilityLabel?: string;
}

/**
 * Every tappable surface in the app. Spring compression + haptics.
 *
 * This exists because `activeOpacity={0.85}` — what the app used before —
 * is the single clearest tell of a default React Native build.
 */
export default function Press({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
  haptic = 'light',
  scale = PRESS_SCALE,
  accessibilityLabel,
}: Props) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(1 - pressed.value * (1 - scale), motion.snappy) },
    ],
  }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        pressed.value = 1;
        if (haptic) {
          Haptics.impactAsync(
            haptic === 'medium'
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light,
          ).catch(() => {});
        }
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      onPress={onPress}
      onLongPress={
        onLongPress
          ? () => {
              // Háptico próprio: sem ele, segurar e ver uma folha subir parece
              // que o toque escapou, e não que a pessoa conseguiu o que quis.
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onLongPress();
            }
          : undefined
      }
    >
      {children}
    </AnimatedPressable>
  );
}
