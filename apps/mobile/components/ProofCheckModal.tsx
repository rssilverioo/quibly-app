import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { PROOF_CHECK } from '@quibly/shared/constants';
import { AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../stores/session.store';
import { uploadProofPhoto } from '../services/storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  background: '#0A0A0F',
  surface: '#141420',
  surfaceLight: '#1E1E2E',
  border: '#2A2A3E',
  primary: '#1E40AF',
  primaryLight: '#2B53D8',
  secondary: '#00D4AA',
  accent: '#FF6B6B',
  warning: '#FFB84D',
  success: '#00D4AA',
  error: '#FF4757',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
};

const FONTS = {
  bold: 'Inter_700Bold',
  semiBold: 'Inter_600SemiBold',
  medium: 'Inter_500Medium',
  regular: 'Inter_400Regular',
};

const DEADLINE_SECONDS = PROOF_CHECK.RESPONSE_DEADLINE_SECONDS;

export default function ProofCheckModal() {
  const { t } = useTranslation('session');
  const { pendingProofCheck, submitProof, setPendingProofCheck, currentSession, userId, proofChecks } =
    useSessionStore();

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [countdown, setCountdown] = useState(DEADLINE_SECONDS);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [missed, setMissed] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start countdown when modal appears
  useEffect(() => {
    if (!pendingProofCheck) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setCountdown(DEADLINE_SECONDS);
    setCapturedPhoto(null);
    setMissed(false);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [pendingProofCheck]);

  // Handle countdown expiry
  useEffect(() => {
    if (countdown === 0 && !capturedPhoto && !submitting) {
      setMissed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Auto-dismiss after 2 seconds
      const timeout = setTimeout(() => {
        setPendingProofCheck(null);
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [countdown, capturedPhoto, submitting, setPendingProofCheck]);

  // Request camera permission
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
      });
      if (photo?.uri) {
        setCapturedPhoto(photo.uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Stop countdown after capture
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }
    } catch {
      // Camera capture failed
    }
  }, []);

  const handleRetake = useCallback(() => {
    setCapturedPhoto(null);
    // Resume countdown from where it was
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!pendingProofCheck || !capturedPhoto || !userId || !currentSession) return;
    setSubmitting(true);

    try {
      // Upload proof photo to Firebase Storage
      const photoUrl = await uploadProofPhoto(
        userId,
        currentSession.id,
        capturedPhoto,
        proofChecks.length,
        pendingProofCheck.id
      );

      // Submit proof with the uploaded photo URL
      await submitProof(photoUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Submit failed — still dismiss
      setPendingProofCheck(null);
    } finally {
      setSubmitting(false);
    }
  }, [pendingProofCheck, capturedPhoto, submitProof, userId, currentSession, proofChecks.length, setPendingProofCheck]);

  if (!pendingProofCheck) return null;

  const countdownMinutes = Math.floor(countdown / 60);
  const countdownSecs = countdown % 60;
  const countdownDisplay = `${countdownMinutes}:${String(countdownSecs).padStart(2, '0')}`;

  return (
    <Modal
      visible={!!pendingProofCheck}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('proof.title')}</Text>
          <Text style={styles.subtitle}>
            {t('proof.subtitle')}
          </Text>
          <Text style={styles.noFaceNote}>{t('proof.noFaceNeeded')}</Text>

          {/* Countdown */}
          {!capturedPhoto && !missed && (
            <View style={styles.countdownContainer}>
              <Text
                style={[
                  styles.countdownText,
                  countdown <= 30 && styles.countdownUrgent,
                ]}
              >
                {countdownDisplay}
              </Text>
            </View>
          )}
        </View>

        {/* Camera / Preview / Missed */}
        <View style={styles.cameraContainer}>
          {missed ? (
            <View style={styles.missedContainer}>
              <AlertTriangle size={48} color={COLORS.error} style={{ marginBottom: 16 }} />
              <Text style={styles.missedText}>{t('proof.missed')}</Text>
              <Text style={styles.missedSubtext}>
                {t('proof.missedSubtext')}
              </Text>
            </View>
          ) : capturedPhoto ? (
            <Image source={{ uri: capturedPhoto }} style={styles.preview} />
          ) : permission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
            />
          ) : (
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionText}>
                {t('proof.cameraPermission')}
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestPermission}
              >
                <Text style={styles.permissionButtonText}>
                  {t('proof.grantPermission')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {!missed && !capturedPhoto && (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              activeOpacity={0.7}
              disabled={countdown === 0}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          )}

          {capturedPhoto && !missed && (
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={handleRetake}
                disabled={submitting}
              >
                <Text style={styles.retakeButtonText}>{t('proof.retake')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  submitting && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <Text style={styles.submitButtonText}>{t('proof.submit')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Header
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontFamily: FONTS.bold,
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: FONTS.medium,
    marginBottom: 6,
  },
  noFaceNote: {
    color: COLORS.secondary,
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    marginBottom: 16,
  },
  countdownContainer: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countdownText: {
    color: COLORS.text,
    fontSize: 22,
    fontFamily: FONTS.bold,
    letterSpacing: 2,
  },
  countdownUrgent: {
    color: COLORS.error,
  },
  // Camera
  cameraContainer: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  camera: {
    flex: 1,
  },
  preview: {
    flex: 1,
    resizeMode: 'cover',
  },
  // Missed state
  missedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  missedIcon: {
    color: COLORS.error,
    fontSize: 48,
    fontFamily: FONTS.bold,
    marginBottom: 16,
  },
  missedText: {
    color: COLORS.error,
    fontSize: 22,
    fontFamily: FONTS.bold,
    marginBottom: 8,
  },
  missedSubtext: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: 'center',
  },
  // Permission
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  permissionText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: FONTS.medium,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
  // Actions
  actionsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingBottom: 50,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.text,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
  },
  retakeButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retakeButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
});
