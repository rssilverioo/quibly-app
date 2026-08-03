import { Platform } from 'react-native';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, space } from '../../theme';

/**
 * The tab bar is a real UIKit `UITabBar`, not a React view.
 *
 * A previous version drew the bar in JS and put glass views on top of it. That
 * cannot reach what iOS 26 does: the system glass refracts what scrolls behind
 * it, and the bar shrinks to a pill as you scroll down, with physics. Neither
 * is reproducible from JS — and the JS bar also swallowed taps, because a
 * floating absolute view is not where UIKit expects a tab bar to be.
 *
 * Handing the bar back to the system gets both effects for free, plus the
 * platform's own hit-testing, accessibility and scroll-to-top behaviour.
 * On Android this renders the Material bottom bar.
 */
export default function TabsLayout() {
  const { t: tr } = useTranslation();
  const { c } = useTheme();

  return (
    <NativeTabs
      // Shrinks the bar into a floating pill on scroll-down and restores it on
      // scroll-up — the Instagram/WhatsApp behaviour. iOS 26 only; older
      // versions ignore it and keep a normal bar.
      minimizeBehavior="onScrollDown"
      tintColor={c.accent}
      iconColor={{ default: c.fgSubtle, selected: c.accent }}
      // Given as a pair rather than one style: a flat `color` would apply to
      // the selected item too and cancel the tint.
      labelStyle={{
        default: { color: c.fgSubtle },
        selected: { color: c.accent },
      }}
    >
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} />
        <Label>{tr('tabs.rooms', { defaultValue: 'Salas' })}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="study">
        <Icon sf="timer" />
        <Label>{tr('tabs.study', { defaultValue: 'Estudar' })}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>{tr('tabs.profile')}</Label>
      </NativeTabs.Trigger>

      {/* Reachable via "see all" from Estudar — one tab less to scan. */}
      <NativeTabs.Trigger name="library" hidden />
    </NativeTabs>
  );
}

/**
 * How much the tab bar covers above the home-indicator inset.
 *
 * The bar floats over the content and — measured, not assumed — UIKit does not
 * add its height to the safe-area inset that `react-native-safe-area-context`
 * reports: that stays at the home indicator's 34pt. Neither expo-router nor
 * react-native-screens exposes the height either, so it has to be a constant.
 *
 * Taken from a screenshot on an iPhone 17 Pro / iOS 26.5: the bar's top edge
 * sits 83pt above the bottom of the screen, and 83 − 34 is the 49pt a UITabBar
 * has measured for as long as it has existed.
 */
const TAB_BAR_HEIGHT = Platform.select({
  ios: 49,
  // Material 3's navigation bar, from the spec — this app ships iOS only, so
  // re-measure the way the iOS value was before trusting it.
  default: 80,
});

/** Bottom space a screen must leave so the tab bar covers nothing. */
export function useTabBarClearance(): number {
  return useSafeAreaInsets().bottom + TAB_BAR_HEIGHT + space.lg;
}
