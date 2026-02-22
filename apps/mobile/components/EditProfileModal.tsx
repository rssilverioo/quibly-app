import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Input from './ui/Input';
import { api } from '../lib/api';
import type { Profile } from '@quibly/shared';

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
  gold: '#FFD700',
};

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (updatedProfile: Profile) => void;
  currentProfile: {
    username: string;
    handle: string;
    bio: string | null;
  };
}

export default function EditProfileModal({
  visible,
  onClose,
  onSave,
  currentProfile,
}: EditProfileModalProps) {
  const [username, setUsername] = useState(currentProfile.username);
  const [handle, setHandle] = useState(currentProfile.handle);
  const [bio, setBio] = useState(currentProfile.bio ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setUsername(currentProfile.username);
      setHandle(currentProfile.handle);
      setBio(currentProfile.bio ?? '');
      setError('');
    }
  }, [visible, currentProfile]);

  const handleSave = async () => {
    setError('');

    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (!handle.trim()) {
      setError('Handle is required.');
      return;
    }
    if (bio.length > 200) {
      setError('Bio must be 200 characters or less.');
      return;
    }

    setIsLoading(true);
    try {
      const updatedProfile = await api.patch<Profile>('/users/me', {
        username: username.trim(),
        handle: handle.trim().replace(/^@/, ''),
        bio: bio.trim() || null,
      });
      onSave(updatedProfile);
      onClose();
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to update profile. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="Username"
              placeholder="Your display name"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />

            <Input
              label="Handle"
              placeholder="yourhandle"
              value={handle}
              onChangeText={(text) => setHandle(text.replace(/^@/, ''))}
              prefix="@"
              autoCapitalize="none"
              hint="Others can find you with your handle"
            />

            <View style={styles.bioContainer}>
              <Text style={styles.bioLabel}>Bio</Text>
              <View style={styles.bioInputWrapper}>
                <Input
                  placeholder="Tell others about yourself..."
                  value={bio}
                  onChangeText={(text) => {
                    if (text.length <= 200) {
                      setBio(text);
                    }
                  }}
                  multiline
                  numberOfLines={4}
                  containerStyle={styles.bioInput}
                />
              </View>
              <Text style={styles.charCount}>
                {bio.length}/200
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  saveText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 20,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 71, 87, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  bioContainer: {
    marginBottom: 16,
  },
  bioLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  bioInputWrapper: {
    // The Input component has its own marginBottom; override via containerStyle
  },
  bioInput: {
    marginBottom: 4,
  },
  charCount: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
});
