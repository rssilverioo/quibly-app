import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react-native';

import { useAuth } from '../../contexts/AuthContext';
import { useSessionStore } from '../../stores/session.store';
import { getStudyHeatmap, type StudyHeatmap } from '../../services/sessions';
import { resumirODia } from '../../lib/dia-de-estudo';
import { nivelDeEstudo } from '../../lib/study-heatmap';
import Press from '../../components/ui/Press';
import { useTheme, text as t, space, radius } from '../../theme';
import { useTabBarClearance } from './_layout';

export default function StudyScreen() {
  const router = useRouter();
  const { t: tr } = useTranslation('home');
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



  /**
   * O mapa de constância, pedido em janela de um ano.
   *
   * A mesma rota que alimenta o mapa do perfil, e de propósito: dois caminhos
   * para "quantos dias você estudou" acabariam discordando, e discordar sobre o
   * número que é a tese do produto é o pior lugar para ter dois caminhos.
   */
  const [mapa, setMapa] = useState<StudyHeatmap | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      getStudyHeatmap(371)
        .then((resposta) => { if (!cancelado) setMapa(resposta); })
        // Sem mapa a tela mostra o dia zerado, que é um estado desenhado. Não
        // vale um alerta: ninguém abre esta aba para ver o histórico.
        .catch(() => {});
      return () => { cancelado = true; };
    }, []),
  );

  const dia = useMemo(
    () => resumirODia(mapa, profile?.daily_goal_minutes),
    [mapa, profile?.daily_goal_minutes],
  );

  /** `D,S,T,Q,Q,S,S` em pt, `S,M,T,W,T,F,S` em inglês. */
  const iniciaisDosDias = useMemo(() => tr('weekdayInitials').split(','), [tr]);

  const totalMinutes = profile?.total_study_minutes ?? 0;
  const totalHours = Math.floor(totalMinutes / 60);

  /**
   * O do meio dizia `Math.ceil(totalMinutes / 25)` sob o rótulo "dias
   * estudados" — a contagem de **blocos de pomodoro**, não de dias. Com 17h no
   * perfil, a tela anunciava "41 dias estudados" para quem talvez tivesse
   * estudado em quatro. Agora vem contado do mapa, que é a mesma fonte do
   * perfil, e por isso os dois nunca discordam.
   */
  const stats = [
    { value: `${totalHours}h`, label: tr('totalHours') },
    { value: String(dia.diasEstudados), label: tr('daysStudiedReal') },
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

          {/* O assunto da tela é **hoje**: o que já foi feito, o que falta, e a
              semana que levou até aqui. Os totais de vida continuam abaixo, mas
              perderam o topo — eles não ajudam ninguém a começar agora. */}
          <Animated.View entering={FadeInDown.duration(300).delay(95)}>
            <View style={[styles.hoje, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.hojeTopo}>
                <Text style={{ ...t.overline, color: c.fgSubtle }}>{tr('today')}</Text>
                <Text style={{ ...t.label, color: dia.cumpriu ? c.accent : c.fgMuted }}>
                  {tr('todayOfGoal', { done: dia.minutosHoje, goal: dia.metaMinutos })}
                </Text>
              </View>

              {/* Barra e não anel: ela cabe na largura do cartão sem competir
                  com o botão, e a leitura de "quanto falta" é a mesma. */}
              <View style={[styles.trilho, { backgroundColor: c.surfaceRaised }]}>
                <View
                  style={[
                    styles.preenchido,
                    { backgroundColor: c.accent, width: `${Math.round(dia.progresso * 100)}%` },
                  ]}
                />
              </View>

              <Text style={{ ...t.caption, color: c.fgMuted }}>
                {dia.cumpriu
                  ? tr('todayDone')
                  : dia.minutosHoje === 0
                    ? tr('todayNothing')
                    : tr('todayLeft', { count: dia.faltamMinutos })}
              </Text>

              {/* A semana inteira, inclusive os dias parados — são eles que dão
                  sentido aos cheios. Mesma escala de intensidade do mapa do
                  perfil, para os dois não contarem histórias diferentes. */}
              <View style={styles.semana}>
                {dia.semana.map((d) => (
                  <View key={d.data} style={styles.diaColuna}>
                    {/* O aro carrega a borda e o quadrado carrega a cor. Estavam
                        na mesma `View`, e a `opacity` da intensidade desbotava a
                        borda junto — hoje ficava indistinguível dos outros dias
                        justo nos dias fracos, que é quando saber que é hoje mais
                        importa. */}
                    <View
                      style={[
                        styles.diaAro,
                        d.hoje && { borderColor: c.accent, borderWidth: 2 },
                      ]}
                    >
                      <View
                        style={[
                          styles.diaQuadrado,
                          {
                            backgroundColor: d.minutos > 0 ? c.accent : c.surfaceRaised,
                            opacity: d.minutos > 0 ? 0.3 + nivelDeEstudo(d.minutos) * 0.175 : 1,
                          },
                        ]}
                      />
                    </View>
                    <Text style={{ ...t.caption, color: c.fgSubtle, fontSize: 10 }}>
                      {iniciaisDosDias[d.diaDaSemana]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

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

          {/* Saíram daqui em 09/08, a pedido do dono do produto: "Capture a
              class" e a lista de baralhos recentes. O motivo é o mesmo para os
              dois — **não é mais o foco**. Esta aba trata de aparecer hoje, e
              nem capturar aula nem revisar o que já foi estudado ajudam alguém
              a começar agora. Os baralhos continuam inteiros na Biblioteca, e a
              captura de aula; o recurso saiu do app em 12/08 e não
              disputar a tela de começar. */}

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
  hoje: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.sm, marginTop: space.lg },
  hojeTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trilho: { height: 8, borderRadius: 4, overflow: 'hidden' },
  preenchido: { height: '100%', borderRadius: 4 },
  semana: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  diaColuna: { alignItems: 'center', gap: 4 },
  diaAro: { padding: 2, borderRadius: 9, borderWidth: 2, borderColor: 'transparent' },
  diaQuadrado: { width: 24, height: 24, borderRadius: 6 },
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
