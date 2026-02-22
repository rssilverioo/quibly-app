import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const COLORS = {
  background: '#0A0A0F',
  primary: '#1E40AF',
};

/**
 * The Study tab immediately redirects to the session setup screen.
 * It acts as a shortcut button in the tab bar.
 */
export default function StudyScreen() {
  const router = useRouter();

  useEffect(() => {
    // Navigate to session setup (push instead of replace to preserve back stack)
    router.push('/session/setup');
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
