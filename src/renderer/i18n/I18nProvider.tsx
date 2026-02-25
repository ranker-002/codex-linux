import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  Language, 
  TranslationKeys, 
  getTranslation, 
  detectLanguage, 
  languageNames,
  defaultLanguage 
} from './index';

interface I18nContextType {
  language: Language;
  t: TranslationKeys;
  setLanguage: (lang: Language) => void;
  availableLanguages: typeof languageNames;
  isRTL: boolean;
  dir: 'ltr' | 'rtl';
}

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'] as const;

export function isRTL(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang as typeof RTL_LANGUAGES[number]);
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
  initialLanguage?: Language;
}

export function I18nProvider({ 
  children, 
  initialLanguage 
}: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (initialLanguage) return initialLanguage;
    
    const stored = localStorage.getItem('codex-language');
    if (stored && ['en', 'fr', 'es', 'de'].includes(stored)) {
      return stored as Language;
    }
    return detectLanguage();
  });

  const [t, setT] = useState<TranslationKeys>(() => getTranslation(language));

  useEffect(() => {
    const translation = getTranslation(language);
    setT(translation);
    localStorage.setItem('codex-language', language);
    
    document.documentElement.lang = language;
    document.documentElement.setAttribute('data-lang', language);
    document.documentElement.dir = isRTL(language) ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const dir = isRTL(language) ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ 
      language, 
      t, 
      setLanguage,
      availableLanguages: languageNames,
      isRTL: isRTL(language),
      dir
    }}>
      <div dir={dir}>
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  
  return context;
}

export function useTranslation() {
  const { t, language, setLanguage, availableLanguages, isRTL } = useI18n();
  
  return {
    t,
    language,
    setLanguage,
    availableLanguages,
    isRTL
  };
}
