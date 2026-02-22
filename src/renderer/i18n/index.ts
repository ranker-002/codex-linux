import { en, TranslationKeys } from './en';
import { fr } from './fr';
import { es } from './es';
import { de } from './de';

export type Language = 'en' | 'fr' | 'es' | 'de';

export const translations: Record<Language, TranslationKeys> = {
  en,
  fr,
  es,
  de
};

export const languageNames: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch'
};

export const defaultLanguage: Language = 'en';

export function getTranslation(lang: Language): TranslationKeys {
  return translations[lang] || translations[defaultLanguage];
}

export function detectLanguage(): Language {
  if (typeof navigator === 'undefined') {
    return defaultLanguage;
  }
  
  const browserLang = navigator.language.split('-')[0];
  const supportedLanguages: Language[] = ['en', 'fr', 'es', 'de'];
  
  if (supportedLanguages.includes(browserLang as Language)) {
    return browserLang as Language;
  }
  
  return defaultLanguage;
}

export { en, fr, es, de };
export type { TranslationKeys };
