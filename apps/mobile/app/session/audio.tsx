import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Pause, Play, SkipForward, X } from 'lucide-react-native';
import {
  AudioClip,
  AudioStudySessionDto,
  getAudioSession,
  pollUntilReady,
  startAudioSession,
} from '../../services/audio-sessions';
import { createSubject, getSubjects } from '../../services/subjects';

const COLORS = {
  background: '#0A0A0F',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  accent: '#3B82F6',
  error: '#FF4757',
};

type Phase = 'loading' | 'ready' | 'playing' | 'paused' | 'done' | 'error';

export default function AudioSessionScreen() {
  const { t } = useTranslation('audio');
  const params = useLocalSearchParams<{ id: string; subjectId: string; leagueId?: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<AudioStudySessionDto | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusSubRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  const cleanupPlayer = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (statusSubRef.current) {
      statusSubRef.current.remove();
      statusSubRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.remove();
      } catch {}
      playerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanupPlayer();
  }, [cleanupPlayer]);

  useEffect(() => {
    (async () => {
      try {
        if (!params.id) throw new Error('Missing session id');
        const first = await getAudioSession(params.id);
        if (first.status === 'ready') {
          setSession(first);
        } else if (first.status === 'failed') {
          throw new Error(first.errorMessage ?? 'Failed to generate session');
        } else {
          const ready = await pollUntilReady(params.id);
          setSession(ready);
        }
        setPhase('ready');
      } catch (err: any) {
        setError(err?.message ?? 'Unexpected error');
        setPhase('error');
      }
    })();
  }, [params.id]);

  const playClipAt = useCallback(
    (index: number, sessionData: AudioStudySessionDto) => {
      cleanupPlayer();

      if (index >= sessionData.clips.length) {
        setPhase('done');
        return;
      }

      const clip = sessionData.clips[index];
      setCurrentIndex(index);

      const player = createAudioPlayer(clip.url);
      playerRef.current = player;

      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          pauseTimerRef.current = setTimeout(() => {
            playClipAt(index + 1, sessionData);
          }, clip.pauseAfterMs);
        }
      });
      statusSubRef.current = sub;

      player.play();
      setPhase('playing');
    },
    [cleanupPlayer],
  );

  const resolveSubjectId = useCallback(async (): Promise<string | null> => {
    if (params.subjectId) return params.subjectId;
    try {
      const subjects = await getSubjects();
      if (subjects.length > 0) return subjects[0].id;
      const created = await createSubject('', 'Audio Study', '#3B82F6');
      return created.id;
    } catch {
      return null;
    }
  }, [params.subjectId]);

  const handleStart = useCallback(async () => {
    if (!session || !params.id) return;
    const subjectId = await resolveSubjectId();
    if (subjectId) {
      try {
        await startAudioSession(params.id, subjectId, params.leagueId);
      } catch {
        // ignore - still allow listening
      }
    }
    playClipAt(0, session);
  }, [session, params.id, params.leagueId, playClipAt, resolveSubjectId]);

  const togglePause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (phase === 'playing') {
      player.pause();
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      setPhase('paused');
    } else if (phase === 'paused') {
      player.play();
      setPhase('playing');
    }
  }, [phase]);

  const skipNext = useCallback(() => {
    if (!session) return;
    playClipAt(currentIndex + 1, session);
  }, [session, currentIndex, playClipAt]);

  const handleExit = useCallback(() => {
    cleanupPlayer();
    router.back();
  }, [cleanupPlayer]);

  const currentClip: AudioClip | undefined = session?.clips[currentIndex];
  const progress = session && session.clips.length > 0
    ? (currentIndex + 1) / session.clips.length
    : 0;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#1E1B4B', '#0A0A0F']}
        style={StyleSheet.absoluteFill}
      />

      <Pressable style={styles.closeBtn} onPress={handleExit} hitSlop={12}>
        <X size={24} color={COLORS.text} />
      </Pressable>

      <View style={styles.center}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {phase === 'loading' ? (
          <>
            <ActivityIndicator color={COLORS.accent} size="large" style={{ marginTop: 32 }} />
            <Text style={styles.statusText}>{t('preparing')}</Text>
          </>
        ) : phase === 'ready' ? (
          <>
            <Text style={styles.title}>{t('ready')}</Text>
            <Text style={styles.subtitle}>
              {session?.plannedDurationMinutes} min · {session?.clips.length} {t('segments')}
            </Text>
            <Pressable style={styles.primaryBtn} onPress={handleStart}>
              <Play size={20} color="#fff" />
              <Text style={styles.primaryBtnLabel}>{t('start')}</Text>
            </Pressable>
          </>
        ) : phase === 'playing' || phase === 'paused' ? (
          <>
            <Text style={styles.clipType}>{t(`type.${currentClip?.type ?? 'intro'}`)}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.counter}>
              {currentIndex + 1} / {session?.clips.length}
            </Text>
            <View style={styles.controls}>
              <Pressable style={styles.iconBtn} onPress={togglePause}>
                {phase === 'playing' ? (
                  <Pause size={28} color="#fff" />
                ) : (
                  <Play size={28} color="#fff" />
                )}
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={skipNext}>
                <SkipForward size={28} color="#fff" />
              </Pressable>
            </View>
          </>
        ) : phase === 'done' ? (
          <>
            <Text style={styles.title}>{t('done')}</Text>
            <Pressable style={styles.primaryBtn} onPress={handleExit}>
              <Text style={styles.primaryBtnLabel}>{t('finish')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: COLORS.error }]}>{t('error')}</Text>
            <Text style={styles.subtitle}>{error}</Text>
            <Pressable style={styles.primaryBtn} onPress={handleExit}>
              <Text style={styles.primaryBtnLabel}>{t('back')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: { width: 100, height: 100, borderRadius: 24, marginBottom: 32 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700', marginTop: 16 },
  subtitle: { color: COLORS.textSecondary, fontSize: 15, marginTop: 8, textAlign: 'center' },
  statusText: { color: COLORS.textSecondary, fontSize: 16, marginTop: 16 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 32,
  },
  primaryBtnLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  clipType: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 24,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.accent },
  counter: { color: COLORS.textSecondary, fontSize: 13, marginTop: 12 },
  controls: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 48,
  },
  iconBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
