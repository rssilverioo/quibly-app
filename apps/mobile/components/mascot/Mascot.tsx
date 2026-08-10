import { memo, useEffect, type ReactNode } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme, motion } from '../../theme';
import { ILUSTRACAO } from './ilustracoes';
import * as P from './parts';

/**
 * Every state the mascot can be in, and the screen that owns it. If a state
 * has no caller it's dead weight — keep this list honest.
 */
export type MascotState =
  | 'idle' | 'wave' | 'happy' | 'celebrate' | 'trophy' | 'medal' | 'crowned'
  | 'star' | 'streak' | 'xp' | 'listening' | 'headphones' | 'thinking'
  | 'working' | 'searching' | 'reading' | 'graduate' | 'focused' | 'sleepy'
  | 'break' | 'sad' | 'worried' | 'offline' | 'locked' | 'dizzy' | 'cool'
  | 'wink' | 'love' | 'surprised' | 'cheer';

/** How the whole figure moves. Chosen per state, not per caller. */
type Motion = 'breathe' | 'bounce' | 'pulse' | 'sway' | 'still';

interface Variant {
  eyes: ReactNode;
  mouth: ReactNode;
  arms: ReactNode;
  /** Sits on the crown of the head; the ears pass over it. */
  worn?: (p: P.PartProps) => ReactNode;
  /** Held at the raised hand, drawn above the arm. */
  prop?: (p: P.PartProps) => ReactNode;
  deco?: (p: P.PartProps) => ReactNode;
  motion: Motion;
}

const VARIANTS: Record<MascotState, Variant> = {
  idle:       { eyes: <P.EyesOpen />, mouth: <P.MouthSmile />, arms: <P.ArmsRest />, motion: 'breathe' },
  wave:       { eyes: <P.EyesOpen />, mouth: <P.MouthGrin />, arms: <P.ArmsRightUp />, motion: 'sway' },
  happy:      { eyes: <P.EyesHappy />, mouth: <P.MouthGrin />, arms: <P.ArmsUp />, motion: 'bounce' },
  celebrate:  { eyes: <P.EyesHappy />, mouth: <P.MouthGrin />, arms: <P.ArmsUp />, worn: P.PartyHat, deco: P.DecoConfetti, motion: 'bounce' },
  trophy:     { eyes: <P.EyesHappy />, mouth: <P.MouthGrin />, arms: <P.ArmsRightUp />, prop: P.PropTrophy, deco: P.DecoSparks, motion: 'bounce' },
  medal:      { eyes: <P.EyesOpen />, mouth: <P.MouthGrin />, arms: <P.ArmsRightUp />, prop: P.PropMedal, motion: 'bounce' },
  crowned:    { eyes: <P.EyesHappy />, mouth: <P.MouthGrin />, arms: <P.ArmsRest />, worn: P.Crown, deco: P.DecoSparks, motion: 'breathe' },
  star:       { eyes: <P.EyesHappy />, mouth: <P.MouthGrin />, arms: <P.ArmsRightUp />, prop: P.PropStar, motion: 'bounce' },
  streak:     { eyes: <P.EyesOpen />, mouth: <P.MouthGrin />, arms: <P.ArmsRightUp />, prop: P.PropFlame, motion: 'bounce' },
  xp:         { eyes: <P.EyesOpen />, mouth: <P.MouthSmirk />, arms: <P.ArmsRightUp />, prop: P.PropBolt, motion: 'bounce' },
  listening:  { eyes: <P.EyesOpen look={14} />, mouth: <P.MouthO />, arms: <P.ArmsRightUp />, deco: P.DecoWaves, motion: 'pulse' },
  headphones: { eyes: <P.EyesHappy />, mouth: <P.MouthSmile />, arms: <P.ArmsRest />, worn: P.Headphones, deco: P.DecoWaves, motion: 'sway' },
  thinking:   { eyes: <P.EyesOpen dy={-10} look={18} />, mouth: <P.MouthFlat />, arms: <P.ArmsRest />, deco: P.DecoDots, motion: 'breathe' },
  working:    { eyes: <P.EyesOpen dy={-6} />, mouth: <P.MouthFlat />, arms: <P.ArmsRightUp />, prop: P.PropPencil, deco: P.DecoDots, motion: 'breathe' },
  searching:  { eyes: <P.EyesOpen look={16} />, mouth: <P.MouthO />, arms: <P.ArmsRightUp />, prop: P.PropGlass, motion: 'sway' },
  reading:    { eyes: <P.EyesHappy />, mouth: <P.MouthSmile />, arms: <P.ArmsRightUp />, prop: P.PropBook, motion: 'breathe' },
  graduate:   { eyes: <P.EyesHappy />, mouth: <P.MouthGrin />, arms: <P.ArmsRest />, worn: P.Cap, deco: P.DecoSparks, motion: 'bounce' },
  focused:    { eyes: <P.EyesOpen ry={34} />, mouth: <P.MouthFlat />, arms: <P.ArmsRightUp />, prop: P.PropClock, motion: 'breathe' },
  sleepy:     { eyes: <P.EyesShut />, mouth: <P.MouthFlat />, arms: <P.ArmsDroop />, deco: P.DecoZzz, motion: 'breathe' },
  break:      { eyes: <P.EyesShut />, mouth: <P.MouthSmile />, arms: <P.ArmsRest />, deco: P.DecoZzz, motion: 'breathe' },
  sad:        { eyes: <P.EyesOpen dy={6} />, mouth: <P.MouthFrown />, arms: <P.ArmsDroop />, motion: 'still' },
  worried:    { eyes: <P.EyesOpen dy={4} ry={52} />, mouth: <P.MouthWobble />, arms: <P.ArmsShrug />, motion: 'still' },
  offline:    { eyes: <P.EyesOpen dy={4} />, mouth: <P.MouthFlat />, arms: <P.ArmsShrug />, prop: P.PropCloudOff, motion: 'still' },
  locked:     { eyes: <P.EyesOpen />, mouth: <P.MouthFlat />, arms: <P.ArmsRightUp />, prop: P.PropLock, motion: 'still' },
  dizzy:      { eyes: <P.EyesDizzy />, mouth: <P.MouthWobble />, arms: <P.ArmsDroop />, motion: 'sway' },
  cool:       { eyes: <P.EyesOpen />, mouth: <P.MouthSmirk />, arms: <P.ArmsRest />, worn: P.Shades, motion: 'breathe' },
  wink:       { eyes: <P.EyesWink />, mouth: <P.MouthSmirk />, arms: <P.ArmsRightUp />, motion: 'sway' },
  love:       { eyes: <P.EyesHeart />, mouth: <P.MouthGrin />, arms: <P.ArmsRightUp />, prop: P.PropHeart, motion: 'pulse' },
  surprised:  { eyes: <P.EyesOpen ry={56} />, mouth: <P.MouthO />, arms: <P.ArmsShrug />, motion: 'bounce' },
  cheer:      { eyes: <P.EyesHappy />, mouth: <P.MouthGrin />, arms: <P.ArmsUp />, deco: P.DecoConfetti, motion: 'bounce' },
};

interface Props {
  state?: MascotState;
  /** Rendered square. 96–200 works for empty states; 40–64 for inline use. */
  size?: number;
  /** Cream body plate for light surfaces. Omit on the app's dark ground. */
  plate?: boolean;
  /** Turn off for screenshots, or where motion would distract. */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}

function MascotView({
  state = 'idle',
  size = 140,
  plate = false,
  animate = true,
  style,
}: Props) {
  const { c } = useTheme();
  const v = VARIANTS[state];

  // O acento tinge os objetos na mão e as faíscas. No castelo ele também
  // pintava a bandeira, que era o que o fazia ler como nosso; o coelho já é a
  // marca por si, e o acento voltou a ser só destaque.
  const accent = c.accent;

  const lift = useSharedValue(0);
  const scale = useSharedValue(1);
  const tilt = useSharedValue(0);

  useEffect(() => {
    lift.value = 0;
    scale.value = 1;
    tilt.value = 0;

    if (!animate) return;

    switch (v.motion) {
      case 'breathe':
        // Barely perceptible — it should read as alive, not as a loading state.
        lift.value = withRepeat(
          withSequence(
            withTiming(-size * 0.018, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
          ), -1, false);
        break;
      case 'bounce':
        // Lands once on mount: celebration is an event, not an ambience.
        lift.value = withSequence(
          withTiming(-size * 0.16, { duration: 260, easing: Easing.out(Easing.quad) }),
          withSpring(0, motion.bouncy),
        );
        scale.value = withSequence(
          withTiming(1.06, { duration: 260 }),
          withSpring(1, motion.bouncy),
        );
        break;
      case 'pulse':
        scale.value = withRepeat(
          withSequence(
            withTiming(1.04, { duration: 700, easing: Easing.inOut(Easing.quad) }),
            withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          ), -1, false);
        break;
      case 'sway':
        tilt.value = withDelay(200, withRepeat(
          withSequence(
            withTiming(4, { duration: 900, easing: Easing.inOut(Easing.quad) }),
            withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          ), -1, true));
        break;
      case 'still':
        break;
    }
  }, [state, animate, size]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.value },
      { scale: scale.value },
      { rotate: `${tilt.value}deg` },
    ],
  }));

  const worn = v.worn?.({ accent });

  /*
   A ilustração, quando existe para este estado.

   Fica **dentro** do mesmo `Animated.View`, e não no lugar dele: é o contêiner
   que respira, pula e balança, então a imagem herda o movimento inteiro. Sem
   isso a troca custaria a animação de 34 telas — era a objeção óbvia, e ela
   não se sustenta.

   `contain` porque as ilustrações não são quadradas (de 192x322 a 396x265) e o
   mascote sempre foi pedido como um lado só. Esticar deformaria o personagem.
  */
  const ilustracao = ILUSTRACAO[state];
  if (ilustracao) {
    return (
      <Animated.View style={[{ width: size, height: size }, animatedStyle, style]}>
        <Image
          source={ilustracao}
          style={{ width: size, height: size }}
          resizeMode="contain"
          // O mascote é decoração: quem lê a tela por voz já recebe o texto ao
          // lado, e anunciar "coelho" no meio dele só atrapalha.
          accessible={false}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle, style]}>
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Defs>
          <LinearGradient id="pelo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#E9F0FF" />
          </LinearGradient>
        </Defs>

        {plate && <Rect width={1024} height={1024} rx={80} fill="#F7F0E8" />}

        <Ellipse cx={512} cy={875} rx={280} ry={58} fill={P.CONTORNO} opacity={0.12} />
        {v.deco?.({ accent })}

        {/*
          A ordem manda: orelhas, corpo e braços vêm **antes** da cabeça, para
          que ela os cubra. É o que dá a leitura de bicho de cabeça grande, com
          os braços saindo de trás em vez de grudados na frente. Trocar a ordem
          põe a linha do braço por cima da bochecha.
        */}

        {/* orelhas */}
        <G strokeLinecap="round" fill="none">
          <Path d="M455 300 C432 214, 420 152, 414 108" stroke={P.CONTORNO} strokeWidth={116} />
          <Path d="M569 300 C592 214, 604 152, 610 108" stroke={P.CONTORNO} strokeWidth={116} />
          <Path d="M455 300 C432 214, 420 152, 414 108" stroke={P.PELO} strokeWidth={94} />
          <Path d="M569 300 C592 214, 604 152, 610 108" stroke={P.PELO} strokeWidth={94} />
          <Path d="M458 292 C438 218, 428 166, 422 132" stroke={P.ORELHA_INTERNA} strokeWidth={40} />
          <Path d="M566 292 C586 218, 596 166, 602 132" stroke={P.ORELHA_INTERNA} strokeWidth={40} />
        </G>

        {/* rabo, tronco e pés */}
        <Circle cx={318} cy={752} r={62} fill={P.PELO} stroke={P.CONTORNO} strokeWidth={20} />
        <Ellipse cx={512} cy={726} rx={198} ry={152} fill="url(#pelo)" stroke={P.CONTORNO} strokeWidth={20} />
        <Ellipse cx={418} cy={856} rx={88} ry={47} fill={P.PELO} stroke={P.CONTORNO} strokeWidth={18} />
        <Ellipse cx={606} cy={856} rx={88} ry={47} fill={P.PELO} stroke={P.CONTORNO} strokeWidth={18} />

        {v.arms}

        {/* cabeça */}
        <Ellipse cx={512} cy={470} rx={240} ry={226} fill="url(#pelo)" stroke={P.CONTORNO} strokeWidth={22} />
        {/* O brilho é o que impede a cabeça de ler como um disco chapado. */}
        <Ellipse cx={430} cy={352} rx={92} ry={54} fill="#FFFFFF" opacity={0.75} transform="rotate(-18, 430, 352)" />

        {v.eyes}

        {/*
          O focinho ocupa a folga entre os olhos (x 465–559) e acima da boca
          (y 528). É o vão mais apertado do desenho, e a razão de o nariz ser
          pequeno em vez de proporcional a um coelho de verdade.
        */}
        <Path d="M494 498 H530 Q512 526 512 526 Q512 526 494 498 Z" fill={P.CONTORNO} />

        {v.mouth}

        {v.prop?.({ accent })}
        {worn}
      </Svg>
    </Animated.View>
  );
}

/**
 * Memoised on purpose. The pomodoro re-renders once a second as the clock
 * ticks; without this, ~40 SVG nodes were rebuilt on every tick and the screen
 * locked up. All props are primitives, so the default shallow compare is right.
 */
const Mascot = memo(MascotView);
export default Mascot;

/** Convenience wrapper for empty states, which always centre the figure. */
export function MascotBlock({ state, size = 132 }: { state: MascotState; size?: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Mascot state={state} size={size} />
    </View>
  );
}
