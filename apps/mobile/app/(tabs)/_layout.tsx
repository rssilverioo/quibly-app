import { Tabs } from 'expo-router';
import { Timer, Layers, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
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
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 22,
          paddingTop: 10,
          // The old bar leaned on a shadow to separate from content. On a
          // near-black ground a shadow is invisible — the hairline does it.
          elevation: 0,
          shadowOpacity: 0,
        },
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
