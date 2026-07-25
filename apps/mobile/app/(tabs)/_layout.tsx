import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Timer, Layers, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import Glass from '../../components/ui/Glass';
import { useTheme, text } from '../../theme';

export default function TabsLayout() {
  const { t: tr } = useTranslation();
  const { c } = useTheme();

  const icon =
    (Icon: typeof Timer) =>
    ({ focused }: { focused: boolean }) => (
      <Icon
        size={22}
        color={focused ? c.fg : c.fgSubtle}
        strokeWidth={focused ? 2.4 : 1.9}
      />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        sceneStyle: { backgroundColor: c.bg },
        // The bar must be see-through for the glass to have anything to
        // refract; an opaque background would defeat the whole effect.
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 84,
          paddingBottom: 22,
          paddingTop: 10,
          elevation: 0,
        },
        tabBarBackground: () => (
          <Glass variant="chrome" cornerRadius={0} style={StyleSheet.absoluteFill} />
        ),
        tabBarActiveTintColor: c.fg,
        tabBarInactiveTintColor: c.fgSubtle,
        tabBarLabelStyle: { ...text.caption, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr('tabs.lessons', { defaultValue: 'Aulas' }), tabBarIcon: icon(Layers) }} />
      <Tabs.Screen name="study" options={{ title: tr('tabs.study', { defaultValue: 'Estudar' }), tabBarIcon: icon(Timer) }} />
      <Tabs.Screen name="profile" options={{ title: tr('tabs.profile'), tabBarIcon: icon(User) }} />
      {/* Reachable via "see all" from Estudar — one tab less to scan. */}
      <Tabs.Screen name="library" options={{ href: null }} />
    </Tabs>
  );
}
