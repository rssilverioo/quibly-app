import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, AppState } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Pause, Play, Square } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';

import { useSessionStore } from '../../stores/session.store';
import Press from '../../components/ui/Press';
import { Mascot } from '../../components/mascot';
import { useTheme, text as t, space, radius } from '../../theme';
import { track } from '../../lib/analytics';
import { onLiveTimerAction } from '../../services/study-timer';
import { mascotForSession, milestoneForMinutes, minutesToNextMilestone } from '@quibly/shared';
import { voltar } from '../../lib/navegacao';
import { pararFoco, segundosDeFocoRestantes } from '../../modules/foco-profundo/src';

const { width: SW } = Dimensions.get('window');
const TIMER_SIZE = Math.min(SW * 0.72, 300);
const STROKE_WIDTH = 6;
const RADIUS = (TIMER_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TOTAL_CYCLES = 4;

/**
 * Quanto tempo "Encerrar" precisa ficar apertado (`FLUXO §7.1`, `§5.13`).
 *
 * Substitui um `Alert.alert` de confirmação. O diálogo tinha um "Cancelar", e
 * um botão de fuga no único instante do app em que não pode haver um: quem
 * abriu o alerta por engano já tinha parado de estudar para lidar com ele.
 * Segurar resolve os dois lados — não dispara sozinho e não interrompe.
 */
const HOLD_TO_END_MS = 400;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ActiveSessionScreen() {
  const router = useRouter();
  const { t: tr } = useTranslation('session');
  const { c } = useTheme();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  /** O `end` falhou. O timer NÃO some — perder a sessão aqui é perder o produto. */
  const [endFailed, setEndFailed] = useState(false);
  const holdProgress = useSharedValue(0);
  /**
   * Bumped once a second purely to re-render. The number on screen is derived
   * from `displayedElapsedSeconds()`, which reads the server's last count plus
   * the wall-clock time since it arrived — so this component needs a reason to
   * recompute, not a counter of its own.
   */
  const [, forceRender] = useState(0);

  const {
    isRunning, isPaused, isDisconnected, phase, phaseElapsedSeconds, pomodorosCompleted,
    timerMode, workDuration, breakDuration, subjectName, subjectColor,
    tick, pause, resume, startBreak, startWork,
    endSession, syncNow, displayedElapsedSeconds,
  } = useSessionStore();

  const isStopwatch = timerMode === 'stopwatch';

  // Stopwatch counts up with no target; the others count down within a phase.
  const phaseDuration = phase === 'work' ? workDuration : breakDuration;
  const totalPhaseSeconds = phaseDuration * 60;
  const remainingSeconds = Math.max(0, totalPhaseSeconds - phaseElapsedSeconds);

  const shownSeconds = isStopwatch ? displayedElapsedSeconds() : remainingSeconds;
  const hours = Math.floor(shownSeconds / 3600);
  const minutes = Math.floor((shownSeconds % 3600) / 60);
  const seconds = shownSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  // A six-hour stopwatch needs an hours field; a 25-minute pomodoro doesn't.
  const timerDisplay =
    isStopwatch && hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(isStopwatch ? minutes + hours * 60 : minutes)}:${pad(seconds)}`;

  // Nothing to fill for a stopwatch — the ring stays a plain track.
  const progress = isStopwatch
    ? 0
    : totalPhaseSeconds > 0
      ? (totalPhaseSeconds - remainingSeconds) / totalPhaseSeconds
      : 0;

  // Work is the accent; break drops to muted so the two phases are legible
  // at a glance from across a desk. Pausado apaga o anel inteiro (`§5.13`): o
  // estado tem que ser visível do outro lado da mesa, não só no ícone do botão.
  const activeColor = isPaused
    ? c.fgSubtle
    : phase === 'work'
      ? c.accent
      : c.fgMuted;
  const timerColor = isPaused ? c.fgMuted : c.fg;

  // The mascot climbs a ladder as the session runs — see
  // packages/shared/src/session-milestones.ts. Driven by *credited* minutes
  // (the server's number), not by the phase countdown, so it reflects real
  // study time rather than where you are inside one pomodoro block.
  const creditedMinutes = Math.floor(displayedElapsedSeconds() / 60);
  const milestone = milestoneForMinutes(creditedMinutes);
  const toNext = minutesToNextMilestone(creditedMinutes);

  // Coming back to the foreground is exactly when the local picture is most
  // likely to be stale, so ask the server rather than extrapolating. The old
  // code guessed the gap with `fastForward(delta)`; now there is a real answer
  // to ask for, and guessing would only reintroduce client-side timekeeping.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  // Navigating away no longer pauses the session. The whole point of Fase 1 is
  // that the timer keeps running when the screen — or the app — goes away.
  useFocusEffect(useCallback(() => undefined, []));

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        tick();
        forceRender((n) => n + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [isRunning, tick]);

  useEffect(() => {
    // A stopwatch has no phase to roll over.
    if (isStopwatch) return;
    if (remainingSeconds <= 0 && isRunning && phaseElapsedSeconds > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (phase === 'work') void startBreak(); else void startWork();
    }
  }, [isStopwatch, remainingSeconds, isRunning, phase, phaseElapsedSeconds, startBreak, startWork]);

  /**
   * Encerrar termina em `/session/published`, nunca na home (`§5.13`).
   *
   * Antes daqui saía `goHome()`: `reset()` + `refreshProfile()` + `router
   * .replace('/')`, e a comemoração de nível chamava a mesma função ao acabar —
   * ou seja, **a comemoração enterrava o post**. As duas coisas mudaram de
   * lugar: a limpeza do store e o `refreshProfile()` são a primeira coisa que
   * `published.tsx` faz, e o `LevelUpAnimation` toca lá, por cima do card, e
   * termina nele.
   *
   * Não há nada a "publicar" nesta transição: o `end` do servidor já criou o
   * post em cada sala (`sessions.service.ts:649`). Esta tela só leva a pessoa
   * até ele.
   */
  const handleEndSession = useCallback(async () => {
    if (isEnding) return;
    setIsEnding(true);
    setEndFailed(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    // Lido antes do `end`, que zera `currentSession` no store. É o único fio
    // que liga a sessão encerrada aos posts que ela acabou de criar — a
    // resposta do `end` não devolve id de post (ver `lib/published-post.ts`).
    const sessionId = useSessionStore.getState().currentSession?.id ?? '';
    /*
     O escudo cai **antes** da chamada, e fora do `try`.

     Se `endSession` falhar — rede caída, servidor fora —, a tela mostra "não
     deu para encerrar" e a pessoa tenta de novo. Derrubar o escudo só no
     sucesso deixaria os apps bloqueados exatamente no momento em que o app
     está sem resposta, que é quando a pessoa mais precisa do telefone.

     Errar para o lado de liberar custa um bloqueio encurtado. Errar para o
     outro custa um telefone preso por causa de uma falha de rede.
    */
    pararFoco();

    // No local pause first — `end` is itself terminal on the server, and
    // pausing would only add a stray interval to the session's record.
    try {
      const result = await endSession();
      // session_completed is server-sourced (ARCHITECTURE.md §3: the
      // server, not the client, owns duration/points). This one is a
      // pure activation milestone the server has no reason to know
      // about — it's about *this device's* funnel, not money.
      if (result.isFirstSession) {
        track('first_session_completed', { minutes: result.durationMinutes });
      }
      const leveledUp = Boolean(
        result.previousLevel && result.newLevel && result.newLevel > result.previousLevel,
      );
      router.replace({
        pathname: '/session/published',
        params: {
          sessionId,
          minutes: String(result.durationMinutes),
          xp: String(result.xpEarned),
          ...(subjectName ? { subjectName } : {}),
          ...(subjectColor ? { subjectColor } : {}),
          ...(leveledUp ? { newLevel: String(result.newLevel) } : {}),
        },
      });
    } catch (err) {
      console.error('[EndSession]', err);
      setIsEnding(false);
      setEndFailed(true);
    }
  }, [endSession, isEnding, router, subjectColor, subjectName]);

  /**
   * Sair do foco custa dez segundos — e só quando há foco.
   *
   * É o atrito do Focus Friend, e ele tem uma função exata: a vontade de largar
   * o estudo dura menos que a contagem. Quem ainda quiser sair aos dez, sai; e
   * é isso que separa atrito de cadeia.
   *
   * O primeiro toque arma, o segundo desarma. Nunca é um caminho de mão única:
   * um botão que, uma vez tocado, encerra sozinho seria pior que não ter atrito
   * nenhum, porque tiraria a decisão da pessoa em vez de adiá-la.
   *
   * Sem bloqueio ativo nada disso aparece — a sessão continua a um "segurar",
   * que é o atrito proporcional a encerrar um cronômetro.
   */
  /**
   * Se há escudo de pé agora.
   *
   * Perguntado ao nativo e não guardado num estado do JS: a sessão pode ter sido
   * restaurada depois de o app morrer, e aí o React não tem memória nenhuma do
   * que foi escolhido lá atrás — mas o escudo continua de pé, e o botão precisa
   * saber disso para pedir os dez segundos.
   */
  const comFoco = segundosDeFocoRestantes() > 0;

  const [contagem, setContagem] = useState<number | null>(null);
  useEffect(() => {
    if (contagem === null) return;
    if (contagem <= 0) { setContagem(null); handleEndSession(); return; }
    const id = setTimeout(() => setContagem((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(id);
  }, [contagem, handleEndSession]);

  // Segurar. Solta antes dos 400ms, o anel vermelho recolhe e nada acontece.
  const startHold = useCallback(() => {
    if (isEnding) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    holdProgress.value = withTiming(
      1,
      { duration: HOLD_TO_END_MS, easing: Easing.linear },
      (finished) => { if (finished) runOnJS(handleEndSession)(); },
    );
  }, [handleEndSession, holdProgress, isEnding]);

  const cancelHold = useCallback(() => {
    holdProgress.value = withTiming(0, { duration: 140 });
  }, [holdProgress]);

  const holdRingProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - holdProgress.value),
    opacity: holdProgress.value > 0 ? 1 : 0,
  }));

  // Pause / resume / end tapped on the Android notification or the iOS Live
  // Activity run the same store methods as the in-app controls, so the two
  // surfaces can never disagree about what the session is doing. Declared after
  // `handleEndSession` because it closes over it.
  useEffect(() => {
    return onLiveTimerAction((action) => {
      if (action === 'pause') void pause();
      else if (action === 'resume') void resume();
      else if (action === 'end') handleEndSession();
    });
  }, [pause, resume, handleEndSession]);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Always available now. Leaving the screen no longer stops the timer,
          so there is no reason to hide the way out while it runs. */}
      <Press
        haptic={false}
        scale={0.92}
        onPress={() => voltar()}
        style={styles.backBtn}
      >
        <ArrowLeft size={22} color={c.fgMuted} />
      </Press>

      <Text style={{ ...t.overline, color: activeColor, letterSpacing: 4 }}>
        {isStopwatch
          ? tr('active.stopwatch')
          : phase === 'work'
            ? tr('active.work')
            : tr('active.break')}
      </Text>

      {/* The heartbeat has been failing past the grace window: the server has
          already closed this session and credited it up to the last beat.
          Saying so is better than animating a timer that runs nowhere. */}
      {isDisconnected && (
        <View style={[styles.banner, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ ...t.caption, color: c.warning, textAlign: 'center' }}>
            {tr('active.disconnected')}
          </Text>
        </View>
      )}

      <View style={styles.timerWrap}>
        <Svg width={TIMER_SIZE} height={TIMER_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={TIMER_SIZE / 2}
            cy={TIMER_SIZE / 2}
            r={RADIUS}
            // Trilho em `surfacePressed`: no claro `c.surface` é branco puro e
            // o anel vazio simplesmente não existia sobre o fundo (`§5.13`).
            stroke={c.surfacePressed}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={TIMER_SIZE / 2}
            cy={TIMER_SIZE / 2}
            r={RADIUS}
            stroke={activeColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            strokeLinecap="round"
          />
          {/* O anel do "segurar para encerrar". Some quando o dedo sai. */}
          <AnimatedCircle
            cx={TIMER_SIZE / 2}
            cy={TIMER_SIZE / 2}
            r={RADIUS}
            stroke={c.danger}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeLinecap="round"
            animatedProps={holdRingProps}
          />
        </Svg>

        {/* Inside the ring: the mascot works while you work and dozes on the
            break. It's the one screen people stare at for 25 minutes. */}
        <View style={styles.timerTextWrap}>
          <Mascot
            state={mascotForSession(creditedMinutes, isRunning && phase === 'work')}
            size={92}
            animate={isRunning}
          />
          {/* `title1` (40), não `display` (64): 64 estoura o anel numa tela de
              375pt e quebra "1:59:59" em duas linhas (`§5.13`). Continua sendo
              o maior número do app — e o único acima de 28. */}
          <Text
            style={{
              ...t.title1,
              color: timerColor,
              fontVariant: ['tabular-nums'],
              marginTop: -space.sm,
            }}
          >
            {timerDisplay}
          </Text>
        </View>
      </View>

      {subjectName && (
        <View style={styles.subjectRow}>
          <View style={[styles.subjectDot, { backgroundColor: subjectColor ?? c.accent }]} />
          <Text style={{ ...t.label, color: c.fgMuted }}>{subjectName}</Text>
        </View>
      )}

      {/* The rung, and how far the next one is. The countdown is the point:
          "13 min para o próximo" lands exactly when someone is deciding
          whether to stop, which is the only moment it can change anything. */}
      <View style={styles.milestoneRow}>
        <Text style={{ ...t.label, color: c.accent }}>{tr(milestone.labelKey)}</Text>
        {toNext !== null && isRunning && (
          <Text style={{ ...t.caption, color: c.fgSubtle }}>
            {tr('milestone.toNext', { minutes: toNext })}
          </Text>
        )}
      </View>

      {/* Cycle dots are meaningless without a target duration. */}
      {!isStopwatch && (
        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_CYCLES }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.cycleDot,
                i < pomodorosCompleted
                  ? { backgroundColor: c.accent }
                  : { borderWidth: 1.5, borderColor: c.borderStrong },
              ]}
            />
          ))}
        </View>
      )}
      {isStopwatch && <View style={styles.stopwatchSpacer} />}

      <Press
        haptic="medium"
        scale={0.92}
        disabled={isDisconnected}
        onPress={() => void (isRunning ? pause() : resume())}
        style={[
          styles.controlBtn,
          { backgroundColor: activeColor, opacity: isDisconnected ? 0.4 : 1 },
        ]}
      >
        {isRunning ? (
          <Pause size={26} color={c.fgOnAccent} fill={c.fgOnAccent} />
        ) : (
          <Play size={26} color={c.fgOnAccent} fill={c.fgOnAccent} style={{ marginLeft: 3 }} />
        )}
      </Press>

      {/* Com bloqueio, tocar e esperar dez segundos. Sem bloqueio, segurar —
          ver `HOLD_TO_END_MS`. */}
      {comFoco ? (
        <Pressable
          onPress={() => setContagem((n) => (n === null ? 10 : null))}
          disabled={isEnding}
          style={[styles.endBtn, { opacity: isEnding ? 0.4 : 1 }]}
        >
          {isEnding ? (
            <Text style={{ ...t.label, color: c.fgMuted }}>{tr('active.ending')}</Text>
          ) : (
            <>
              <Square size={14} color={c.danger} />
              <Text style={{ ...t.label, color: c.danger }}>
                {contagem === null
                  ? tr('setup.focusCancel')
                  : tr('setup.focusCancelIn', { count: contagem })}
              </Text>
            </>
          )}
        </Pressable>
      ) : (
        <Pressable
          onPressIn={startHold}
          onPressOut={cancelHold}
          disabled={isEnding}
          style={[styles.endBtn, { opacity: isEnding ? 0.4 : 1 }]}
        >
          {isEnding ? (
            <Text style={{ ...t.label, color: c.fgMuted }}>{tr('active.ending')}</Text>
          ) : (
            <>
              <Square size={14} color={c.danger} />
              <Text style={{ ...t.label, color: c.danger }}>{tr('active.holdToEnd')}</Text>
            </>
          )}
        </Pressable>
      )}

      {/* O timer não some quando o `end` falha. */}
      {endFailed && (
        <Press haptic="light" scale={0.96} onPress={handleEndSession} style={styles.endFailedRow}>
          <Text style={{ ...t.caption, color: c.danger, textAlign: 'center' }}>
            {tr('active.endFailed')}
          </Text>
          <Text style={{ ...t.caption, color: c.accent }}>{tr('common:retry')}</Text>
        </Press>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  backBtn: { position: 'absolute', top: 60, left: space.lg, padding: space.sm },

  timerWrap: {
    width: TIMER_SIZE,
    height: TIMER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xl,
    marginBottom: space.xl,
  },
  timerTextWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },

  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  milestoneRow: { alignItems: 'center', gap: 2, marginTop: space.sm },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },

  dotsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, marginBottom: space.xxl },
  cycleDot: { width: 8, height: 8, borderRadius: 4 },
  /** Keeps the control button in the same spot when the cycle dots are gone. */
  stopwatchSpacer: { height: 8, marginTop: space.lg, marginBottom: space.xxl },

  controlBtn: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: space.sm,
    paddingHorizontal: space.xl,
    marginTop: space.lg,
  },
  endFailedRow: { alignItems: 'center', gap: 2, marginTop: space.sm },

  banner: {
    marginTop: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
