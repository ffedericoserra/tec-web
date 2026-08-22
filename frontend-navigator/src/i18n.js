import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import it from './locales/it.json';
import en from './locales/en.json';

export const LANGUAGE_STORAGE_KEY = 'artaround_language';
export const SUPPORTED_LANGUAGES = ['it', 'en'];

const LANGUAGE_LOCALES = {
  it: 'it-IT',
  en: 'en-US',
};

const CONTENT_LANGUAGE_LOCALES = {
  ...LANGUAGE_LOCALES,
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
};

export function normalizeLanguage(value) {
  const language = String(value || '').toLowerCase().split('-')[0];
  if (language === 'es') return 'en';
  return SUPPORTED_LANGUAGES.includes(language) ? language : null;
}

export function localeForLanguage(value) {
  return LANGUAGE_LOCALES[normalizeLanguage(value)] || LANGUAGE_LOCALES.it;
}

export function speechLocaleForLanguage(value) {
  const language = String(value || '').toLowerCase().split('-')[0];
  return CONTENT_LANGUAGE_LOCALES[language] || LANGUAGE_LOCALES.it;
}

function storedLanguage() {
  if (typeof window === 'undefined') return 'it';
  return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) || 'it';
}

function applyLanguage(language) {
  const normalized = normalizeLanguage(language) || 'it';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized;
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  }
  return normalized;
}

const initialLanguage = applyLanguage(storedLanguage());

i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
  },
  lng: initialLanguage,
  fallbackLng: 'it',
  supportedLngs: SUPPORTED_LANGUAGES,
  load: 'languageOnly',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

i18n.on('languageChanged', applyLanguage);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== LANGUAGE_STORAGE_KEY) return;
    const language = normalizeLanguage(event.newValue) || 'it';
    if (language !== normalizeLanguage(i18n.resolvedLanguage)) {
      i18n.changeLanguage(language);
    }
  });
}

export function currentLanguage() {
  return normalizeLanguage(i18n.resolvedLanguage || i18n.language) || 'it';
}

export function changeLanguage(language) {
  return i18n.changeLanguage(normalizeLanguage(language) || 'it');
}

export function syncLanguageFromUser(user) {
  const language = normalizeLanguage(user?.language);
  if (language && language !== currentLanguage()) {
    i18n.changeLanguage(language);
  }
}

export default i18n;
