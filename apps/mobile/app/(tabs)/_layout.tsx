import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Timer, Layers, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import Glass from '../../components/ui/Glass';
import { useTheme, text, space } from '../../theme';

/**
 * Geometry of the floating bar. iOS 26 tab bars are a capsule inset from the
 * edges, not a full-bleed strip pinned to the bottom — that shape is most of
 * what makes the glass read as glass, because content is visible around it as
 * well as through it.
 */
export const TAB_BAR = {
  height: 64,
  inset: 16,
  /** Gap between the capsule and the safe-area edge. */
  lift: 10,
};

/** What a screen must leave clear at the bottom so the bar covers nothing. */
export const TAB_BAR_CLEARANCE = TAB_BAR.height + TAB_BAR.lift + space.xl;

export default function TabsLayout() {
  const { t: tr } = useTranslation();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

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
          position: 'absolute',
          left: TAB_BAR.inset,
          right: TAB_BAR.inset,
          bottom: insets.bottom + TAB_BAR.lift,
          height: TAB_BAR.height,
          borderRadius: TAB_BAR.height / 2,
          // The capsule's fill is the Glass view behind it; anything opaque
          // here would sit on top of the effect and flatten it.
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarItemStyle: { height: TAB_BAR.height - 16 },
        tabBarBackground: () => (
          <Glass
            variant="chrome"
            cornerRadius={TAB_BAR.height / 2}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarActiveTintColor: c.fg,
        tabBarInactiveTintColor: c.fgSubtle,
        tabBarLabelStyle: { ...text.caption, fontSize: 10, marginTop: 2 },
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
