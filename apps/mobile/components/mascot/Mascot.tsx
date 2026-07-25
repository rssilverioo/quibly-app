import { memo, useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
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
  /** Sits on the battlements; suppresses the flag. */
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

/** Hats occupy the same battlement as the flagpole. */
type WornPart = NonNullable<Variant['worn']>;
const HIDES_FLAG: ReadonlySet<WornPart> = new Set<WornPart>([P.Cap, P.Crown, P.PartyHat]);

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

  // The accent tints the flag, held props and sparks — it's what makes the
  // castle read as Quibly's rather than a stock mascot.
  const accent = c.accent;
  const pole = plate ? '#4D3324' : '#5C5C68';
  const flagFill = plate ? '#7A4E2F' : accent;

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
  const showFlag = !(v.worn && HIDES_FLAG.has(v.worn));

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle, style]}>
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Defs>
          <LinearGradient id="body" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#9A6B47" />
            <Stop offset="100%" stopColor="#6E472F" />
          </LinearGradient>
          <LinearGradient id="door" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#513523" />
            <Stop offset="100%" stopColor="#2F1F17" />
          </LinearGradient>
        </Defs>

        {plate && <Rect width={1024} height={1024} rx={80} fill="#F7F0E8" />}

        <Ellipse cx={512} cy={875} rx={280} ry={58} fill="#3B2A20" opacity={0.12} />
        {v.deco?.({ accent })}

        {showFlag && (
          <G>
            <Rect x={497} y={113} width={30} height={168} rx={15} fill={pole} />
            <Path d="M525 126 C600 96, 660 120, 709 153 C649 180, 601 194, 525 177 Z" fill={flagFill} />
          </G>
        )}

        {/* body */}
        <Rect x={280} y={300} width={464} height={430} rx={72} fill="url(#body)" />
        <Rect x={260} y={255} width={110} height={120} rx={26} fill="#9A6B47" />
        <Rect x={392} y={235} width={110} height={140} rx={26} fill="#A6754F" />
        <Rect x={522} y={235} width={110} height={140} rx={26} fill="#A6754F" />
        <Rect x={654} y={255} width={110} height={120} rx={26} fill="#9A6B47" />
        <Rect x={335} y={285} width={354} height={95} rx={28} fill="#A6754F" />

        <G fill="none" stroke="#5E3E2A" strokeWidth={10} opacity={0.38}>
          <Path d="M300 430 H724" /><Path d="M300 540 H724" /><Path d="M300 650 H724" />
          <Path d="M385 380 V430" /><Path d="M515 380 V430" /><Path d="M645 380 V430" />
          <Path d="M350 430 V540" /><Path d="M485 430 V540" /><Path d="M620 430 V540" />
          <Path d="M410 540 V650" /><Path d="M550 540 V650" /><Path d="M680 540 V650" />
        </G>

        {v.eyes}
        {v.mouth}

        <Path d="M430 730 V630 Q430 565 512 565 Q594 565 594 630 V730 Z" fill="url(#door)" />
        <Path d="M512 578 V730" stroke="#8F6245" strokeWidth={12} opacity={0.55} />
        <Ellipse cx={552} cy={655} rx={12} ry={12} fill={accent} />

        {v.arms}

        <Rect x={350} y={700} width={122} height={160} rx={52} fill="#6F4932" />
        <Rect x={552} y={700} width={122} height={160} rx={52} fill="#6F4932" />
        <Ellipse cx={410} cy={858} rx={82} ry={48} fill="#5B3B29" />
        <Ellipse cx={614} cy={858} rx={82} ry={48} fill="#5B3B29" />

        <Path
          d="M329 358 C380 318, 436 310, 500 309"
          fill="none" stroke="#C89A74" strokeWidth={18} strokeLinecap="round" opacity={0.34}
        />

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
