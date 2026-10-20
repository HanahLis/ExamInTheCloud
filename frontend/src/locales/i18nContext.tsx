import React, { createContext, useContext, useState, useEffect } from 'react';
import vi from './vi.json';
import en from './en.json';
import la from './la.json';

export type Language = 'vi' | 'en' | 'la';

const translations: Record<Language, Record<string, string>> = { vi, en, la };

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'vi',
  setLang: () => {},
  t: (key) => key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('cloudexam_lang') as Language) || 'vi';
  });

  useEffect(() => {
    localStorage.setItem('cloudexam_lang', lang);
  }, [lang]);

  const t = (key: string): string => {
    const dict = translations[lang] || translations.vi;
    return dict[key] || translations.vi[key] || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
