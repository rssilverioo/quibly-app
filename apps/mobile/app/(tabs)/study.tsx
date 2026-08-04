import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Play, ChevronRight, Layers, Camera } from 'lucide-react-native';
import type { FlashcardSet } from '@quibly/shared';

import { useAuth } from '../../contexts/AuthContext';
import { useSessionStore } from '../../stores/session.store';
import { listFlashcardSets } from '../../services/flashcards';
import Press from '../../components/ui/Press';
import { useTheme, text as t, space, radius } from '../../theme';
import { useTabBarClearance } from './_layout';

export default function StudyScreen() {
  const router = useRouter();
  const { t: tr } = useTranslation('home');
  const { t: lessonsTr } = useTranslation('lessons');
  const { c } = useTheme();
  const tabBarClearance = useTabBarClearance();
  const { profile } = useAuth();
  const {
    isPaused,
    isRunning,
    currentSession,
    subjectName: pausedSubjectName,
    displayedElapsedSeconds,
  } = useSessionStore();

  /**
   * Uma sessão **rodando** também precisa aparecer aqui.
   *
   * Este card era `{isPaused && …}`: aparecia se você tinha pausado e sumia se
   * estava rodando. Como sair de `session/active` não para nada — o servidor é
   * que conta o tempo, via heartbeat —, o efeito era uma sessão viva e invisível
   * no app inteiro. Rodando e parado ficavam idênticos na tela, e a leitura
   * natural de quem usa é "pausou sozinho".
   *
   * Foi exatamente esse o relato do dono do produto em 04/08: *"se eu saio dele,
   * ele não continua rolando"*. Continuava; só não havia como saber.
   */
  const temSessaoViva = Boolean(currentSession) && (isRunning || isPaused);

  /**
   * O relógio precisa bater, e nada aqui o faria bater sozinho.
   *
   * `displayedElapsedSeconds()` é derivado do último beat do servidor mais o
   * tempo desde então — ou seja, o valor certo é calculado **no render**, e sem
   * um render por segundo o card mostraria um número parado. Card de "estudando
   * agora" com número congelado é exatamente a impressão de sessão morta que
   * este trabalho existe para desfazer.
   *
   * Só bate quando a aba está em foco e a sessão está correndo: parada, o
   * servidor já congelou a contagem e reagendar não mudaria pixel nenhum.
   */
  const [, forcarRender] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!temSessaoViva || !isRunning) return;
      const id = setInterval(() => forcarRender((n) => n + 1), 1000);
      return () => clearInterval(id);
    }, [temSessaoViva, isRunning]),
  );

  const segundos = temSessaoViva ? displayedElapsedSeconds() : 0;
  const relogio = [
    Math.floor(segundos / 3600),
    Math.floor((segundos % 3600) / 60),
    segundos % 60,
  ]
    // A hora só aparece depois que existe: um card que abre em "00:23:14"
    // desperdiça o dado mais informativo (os minutos) no campo mais estável.
    .slice(segundos >= 3600 ? 0 : 1)
    .map((n) => String(n).padStart(2, '0'))
    .join(':');

  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);

  const hasLoaded = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const sets = await listFlashcardSets();
          if (!cancelled) setFlashcardSets(sets ?? []);
        } catch {}
        if (!cancelled) hasLoaded.current = true;
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const totalMinutes = profile?.total_study_minutes ?? 0;
  const totalHours = Math.floor(totalMinutes / 60);

  const stats = [
    { value: `${totalHours}h`, label: tr('totalHours') },
    { value: String(Math.ceil(totalMinutes / 25)), label: tr('streakCalendar.daysStudied') },
    { value: String(profile?.current_streak ?? 0), label: tr('dayStreak', { count: profile?.current_streak ?? 0 }) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(300)}>
            <Text style={{ ...t.title2, color: c.fg }}>{tr('startStudying')}</Text>
          </Animated.View>

          {/* O herói de 64pt saiu. Ele repetia, em `text.display`, exatamente o
              primeiro mosaico da faixa de números logo abaixo — e a referência
              não tem número grande em lugar nenhum (§2.2, §7). Hierarquia aqui
              vem de posição: a ação primária vem antes do dado. */}

          {/* Uma sessão viva — rodando ou pausada — vem antes de começar outra.
              A cor é o que separa os dois estados: âmbar pede ação (você
              parou), o acento apenas informa (está correndo, e o tempo ao lado
              prova). */}
          {temSessaoViva && (
            <Animated.View entering={FadeInDown.duration(300).delay(80)}>
              <Press
                haptic="medium"
                scale={0.985}
                onPress={() => router.push('/session/active')}
                accessibilityLabel={`${isPaused ? tr('sessionPaused') : tr('sessionRunning')} · ${relogio}`}
                style={[
                  styles.resumeCard,
                  { backgroundColor: c.surface, borderColor: isPaused ? c.warning : c.accent },
                ]}
              >
                <View
                  style={[styles.pausedDot, { backgroundColor: isPaused ? c.warning : c.accent }]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...t.bodyStrong, color: c.fg }}>
                    {isPaused ? tr('sessionPaused') : tr('sessionRunning')}
                  </Text>
                  {!!pausedSubjectName && (
                    <Text style={{ ...t.caption, color: c.fgSubtle, marginTop: 2 }}>
                      {pausedSubjectName}
                    </Text>
                  )}
                </View>
                {/* Enquanto roda, o tempo é a informação; parado, ele já está
                    congelado e o que importa é o convite para voltar. */}
                <Text style={{ ...t.label, color: isPaused ? c.warning : c.fgMuted }}>
                  {isPaused ? tr('resume') : relogio}
                </Text>
              </Press>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(300).delay(110)}>
            <Press
              haptic="medium"
              scale={0.985}
              onPress={() => router.push('/session/setup')}
              style={[styles.cta, { backgroundColor: c.accent }]}
            >
              <Play size={19} color={c.fgOnAccent} fill={c.fgOnAccent} />
              <Text style={{ ...t.bodyStrong, color: c.fgOnAccent }}>
                {tr('startStudyingSubtitle')}
              </Text>
            </Press>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(300).delay(150)} style={styles.statsRow}>
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <Text style={{ ...t.title3, color: c.fg }}>{stat.value}</Text>
                <Text numberOfLines={1} style={{ ...t.caption, color: c.fgSubtle, marginTop: 2 }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(300).delay(175)} style={styles.lessonCapture}>
            <Press
              scale={0.98}
              onPress={() => router.push('/lesson/capture')}
              style={[styles.deckRow, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <View style={[styles.deckIcon, { backgroundColor: c.surfaceRaised }]}>
                <Camera size={16} color={c.fgMuted} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...t.bodyStrong, color: c.fg }}>{lessonsTr('capture')}</Text>
                <Text style={{ ...t.caption, color: c.fgMuted, marginTop: 2 }}>
                  {lessonsTr('captureSub')}
                </Text>
              </View>
              <ChevronRight size={17} color={c.fgSubtle} />
            </Press>
          </Animated.View>

          {flashcardSets.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(190)} style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={{ ...t.overline, color: c.fgSubtle }}>{tr('continueStudying')}</Text>
                <Press haptic={false} scale={0.94} onPress={() => router.push('/(tabs)/library')}>
                  <Text style={{ ...t.caption, color: c.fgMuted }}>{tr('seeAll')}</Text>
                </Press>
              </View>

              <View style={{ gap: space.sm }}>
                {flashcardSets.slice(0, 5).map((set) => (
                  <Press
                    key={set.id}
                    scale={0.98}
                    onPress={() => router.push(`/flashcards/${set.id}`)}
                    style={[styles.deckRow, { backgroundColor: c.surface, borderColor: c.border }]}
                  >
                    <View style={[styles.deckIcon, { backgroundColor: c.surfaceRaised }]}>
                      <Layers size={15} color={c.fgMuted} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ ...t.bodyStrong, color: c.fg }}>
                        {set.title}
                      </Text>
                      <Text style={{ ...t.caption, color: c.fgSubtle, marginTop: 2 }}>
                        {set._count?.flashcards ?? 0}
                      </Text>
                    </View>
                    <ChevronRight size={17} color={c.fgSubtle} />
                  </Press>
                ))}
              </View>
            </Animated.View>
          )}

          {/* The native tab bar floats over the content — leave room for it. */}
          <View style={{ height: tabBarClearance }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.lg, paddingTop: space.md },

  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: space.md,
  },
  pausedDot: { width: 8, height: 8, borderRadius: 4 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 54,
    borderRadius: radius.lg,
    marginTop: space.lg,
  },

  statsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  lessonCapture: { marginTop: space.xl },
  statCard: {
    flex: 1,
    padding: space.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },

  section: { marginTop: space.xxl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },

  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  deckIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
