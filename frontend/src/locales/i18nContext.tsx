import React, { createContext, useContext, useState, useEffect } from 'react';
import vi from './vi.json';
import en from './en.json';
import la from './la.json';
import de from './de.json';

export type Language = 'vi' | 'en' | 'la' | 'de';

const translations: Record<Language, Record<string, string>> = { vi, en, la, de };

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
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

  const t = (key: string, params?: Record<string, string | number>): string => {
    const dict = translations[lang] || translations.vi;
    let str = dict[key] || translations.vi[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return str;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
