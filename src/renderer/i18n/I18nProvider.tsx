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
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  return (
    <I18nContext.Provider value={{ 
      language, 
      t, 
      setLanguage,
      availableLanguages: languageNames 
    }}>
      {children}
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
  const { t, language, setLanguage, availableLanguages } = useI18n();
  
  return {
    t,
    language,
    setLanguage,
    availableLanguages,
    isRTL: false
  };
}
