import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from '../locales/fr.json';
import en from '../locales/en.json';

export const UI_LANGUAGE_KEY = 'ui_language';
export const UI_LANGUAGE_STORAGE_KEY = 'suivi-frais.uiLanguage';

export type UiLanguage = 'fr' | 'en';

export function normalizeUiLanguage(
  value: string | null | undefined,
): UiLanguage {
  return value === 'en' ? 'en' : 'fr';
}

export function localeTag(lang: UiLanguage): string {
  return lang === 'en' ? 'en-GB' : 'fr-FR';
}

export function currentLocaleTag(): string {
  return localeTag(normalizeUiLanguage(i18n.language));
}

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: 'fr',
  fallbackLng: ['fr', 'en'],
  interpolation: { escapeValue: false },
});

export default i18n;
