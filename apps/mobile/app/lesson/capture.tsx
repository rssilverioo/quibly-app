import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import { Mic, FileText, Camera, X, Square } from 'lucide-react-native';

import Press from '../../components/ui/Press';
import LiveDot from '../../components/ui/LiveDot';
import { captureLesson, type CaptureFile } from '../../services/lessons';
import { Mascot } from '../../components/mascot';
import { useTheme, text as t, space, radius } from '../../theme';
import i18n from '../../lib/i18n';
import { track } from '../../lib/analytics';
import { voltar } from '../../lib/navegacao';

type Mode = 'choose' | 'recording' | 'uploading';

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CaptureScreen() {
  const router = useRouter();
  const { t: tr } = useTranslation('lessons');
  const { c } = useTheme();

  const [mode, setMode] = useState<Mode>('choose');

  // LOW_QUALITY is the right call for speech: HIGH_QUALITY blows past
  // Whisper's 25MB ceiling in about ten minutes.
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
  }, []);

  const send = async (file: CaptureFile, durationSec?: number) => {
    const source = file.type.startsWith('audio/')
      ? 'audio'
      : file.type === 'application/pdf'
      ? 'document'
      : 'photo';
    setMode('uploading');
    try {
      const lesson = await captureLesson(file, {
        language: i18n.language,
        durationSec,
      });
      track('lesson_captured', { source, seconds: durationSec });
      router.replace(`/lesson/${lesson.id}`);
    } catch (err: any) {
      setMode('choose');
      track('capture_failed', { source, reason: err?.message ?? 'unknown' });
      Alert.alert(tr('statusFailed'), err?.message ?? 'Upload failed');
    }
  };

  const startRecording = async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(tr('micDenied'));
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setMode('recording');
  };

  const stopRecording = async () => {
    const durationSec = Math.round((recorderState.durationMillis ?? 0) / 1000);
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setMode('choose');
      Alert.alert(tr('statusFailed'));
      return;
    }
    await send({ uri, name: 'aula.m4a', type: 'audio/m4a' }, durationSec);
  };

  const discardRecording = async () => {
    await recorder.stop().catch(() => {});
    setMode('choose');
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await send({
      uri: asset.uri,
      name: asset.name || 'material.pdf',
      type: 'application/pdf',
    });
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await send({
      uri: asset.uri,
      name: asset.fileName || 'caderno.jpg',
      type: asset.mimeType || 'image/jpeg',
    });
  };

  if (mode === 'uploading') {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Mascot state="working" size={140} />
        <Text style={{ ...t.label, color: c.fgMuted, marginTop: space.lg }}>
          {tr('statusProcessing')}
        </Text>
      </View>
    );
  }

  if (mode === 'recording') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView style={styles.recordWrap} edges={['top', 'bottom']}>
          <Animated.View entering={FadeIn} style={styles.recordCenter}>
            <Mascot state="listening" size={168} style={{ marginBottom: space.lg }} />
            <View style={styles.recordBadge}>
              <LiveDot size={8} />
              <Text style={{ ...t.overline, color: c.live }}>{tr('recording')}</Text>
            </View>

            {/* `title1`, não `display`: 64pt saiu do app inteiro (§3.2.1). O
                único número acima de 28 é o do timer de sessão, e este
                cronômetro de gravação segue a mesma régua. */}
            <Text style={{ ...t.title1, color: c.fg, marginTop: space.lg }}>
              {formatClock(recorderState.durationMillis ?? 0)}
            </Text>

            <Text style={{ ...t.caption, color: c.fgSubtle, marginTop: space.sm }}>
              {tr('recordingLimit')}
            </Text>
          </Animated.View>

          <View style={styles.recordActions}>
            <Press
              haptic="medium"
              onPress={stopRecording}
              style={[styles.stopBtn, { backgroundColor: c.accent }]}
            >
              <Square size={17} color={c.fgOnAccent} fill={c.fgOnAccent} />
              <Text style={{ ...t.bodyStrong, color: c.fgOnAccent }}>
                {tr('stopAndProcess')}
              </Text>
            </Press>

            <Press haptic="light" onPress={discardRecording} style={styles.discardBtn}>
              <Text style={{ ...t.label, color: c.fgMuted }}>{tr('discard')}</Text>
            </Press>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const modes = [
    { key: 'record', Icon: Mic, title: tr('modeRecord'), sub: tr('modeRecordSub'), onPress: startRecording, primary: true },
    { key: 'pdf', Icon: FileText, title: tr('modePdf'), sub: tr('modePdfSub'), onPress: pickPdf, primary: false },
    { key: 'photo', Icon: Camera, title: tr('modePhoto'), sub: tr('modePhotoSub'), onPress: takePhoto, primary: false },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Press haptic={false} scale={0.9} onPress={() => voltar()} style={styles.closeBtn}>
            <X size={22} color={c.fgMuted} />
          </Press>
        </View>

        <View style={styles.body}>
          <Animated.View entering={FadeInDown.duration(320)}>
            <Text style={{ ...t.title2, color: c.fg }}>{tr('captureTitle')}</Text>
            <Text style={{ ...t.body, color: c.fgMuted, marginTop: space.sm }}>
              {tr('captureSub')}
            </Text>
          </Animated.View>

          <View style={styles.modes}>
            {modes.map((m, i) => (
              <Animated.View key={m.key} entering={FadeInDown.duration(320).delay(60 + i * 50)}>
                <Press
                  haptic="medium"
                  onPress={m.onPress}
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: m.primary ? c.accent : c.surface,
                      borderColor: m.primary ? c.accent : c.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.modeIcon,
                      { backgroundColor: m.primary ? 'rgba(0,0,0,0.12)' : c.surfaceRaised },
                    ]}
                  >
                    <m.Icon size={20} color={m.primary ? c.fgOnAccent : c.fg} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...t.bodyStrong, color: m.primary ? c.fgOnAccent : c.fg }}>
                      {m.title}
                    </Text>
                    <Text
                      style={{
                        ...t.caption,
                        color: m.primary ? 'rgba(10,10,12,0.66)' : c.fgMuted,
                        marginTop: 3,
                      }}
                    >
                      {m.sub}
                    </Text>
                  </View>
                </Press>
              </Animated.View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { paddingHorizontal: space.lg, paddingTop: space.sm, alignItems: 'flex-start' },
  closeBtn: { padding: space.sm },

  body: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.xl },
  modes: { gap: space.md, marginTop: space.xxl },

  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  modeIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  recordWrap: { flex: 1, justifyContent: 'space-between', paddingHorizontal: space.xl },
  recordCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  recordBadge: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  recordActions: { gap: space.md, paddingBottom: space.xl },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 18,
    borderRadius: radius.lg,
  },
  discardBtn: { alignItems: 'center', paddingVertical: space.md },
});
