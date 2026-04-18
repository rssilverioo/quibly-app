import { Tabs } from 'expo-router';
import { FONTS } from '@quibly/shared/constants';
import { Home, Timer, Layers, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

const TAB_ACTIVE = '#1E40AF';
const TAB_INACTIVE = '#94A3C8';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderTopColor: 'rgba(255,255,255,0.5)',
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 20,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarLabelStyle: {
          fontFamily: FONTS.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => (
            <Home
              size={22}
              color={focused ? TAB_ACTIVE : TAB_INACTIVE}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: t('tabs.study', { defaultValue: 'Study' }),
          tabBarIcon: ({ focused }) => (
            <Timer
              size={22}
              color={focused ? TAB_ACTIVE : TAB_INACTIVE}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ focused }) => (
            <Layers
              size={22}
              color={focused ? TAB_ACTIVE : TAB_INACTIVE}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => (
            <User
              size={22}
              color={focused ? TAB_ACTIVE : TAB_INACTIVE}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
    </Tabs>
  );
}
