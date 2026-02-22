import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// English
import enCommon from '../locales/en/common.json';
import enAuth from '../locales/en/auth.json';
import enHome from '../locales/en/home.json';
import enProfile from '../locales/en/profile.json';
import enLeagues from '../locales/en/leagues.json';
import enSession from '../locales/en/session.json';
import enFeed from '../locales/en/feed.json';
import enNotifications from '../locales/en/notifications.json';

// Português (BR)
import ptCommon from '../locales/pt-BR/common.json';
import ptAuth from '../locales/pt-BR/auth.json';
import ptHome from '../locales/pt-BR/home.json';
import ptProfile from '../locales/pt-BR/profile.json';
import ptLeagues from '../locales/pt-BR/leagues.json';
import ptSession from '../locales/pt-BR/session.json';
import ptFeed from '../locales/pt-BR/feed.json';
import ptNotifications from '../locales/pt-BR/notifications.json';

const LANGUAGE_KEY = '@quibly/language';

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    try {
      const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (stored) {
        callback(stored);
        return;
      }
    } catch {}
    const deviceLocale = getLocales()[0]?.languageTag ?? 'en';
    const lang = deviceLocale.startsWith('pt') ? 'pt-BR' : 'en';
    callback(lang);
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lng);
    } catch {}
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'home', 'profile', 'leagues', 'session', 'feed', 'notifications'],
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        home: enHome,
        profile: enProfile,
        leagues: enLeagues,
        session: enSession,
        feed: enFeed,
        notifications: enNotifications,
      },
      'pt-BR': {
        common: ptCommon,
        auth: ptAuth,
        home: ptHome,
        profile: ptProfile,
        leagues: ptLeagues,
        session: ptSession,
        feed: ptFeed,
        notifications: ptNotifications,
      },
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
