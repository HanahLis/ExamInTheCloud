import React, { createContext, useContext, useState } from 'react';
import en from './en.json';
import vi from './vi.json';
import la from './la.json';

const translations = { en, vi, la };

const I18nContext = createContext({
  t: (key) => key,
  setLang: () => {}
});

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState('vi');

  const t = (key) => {
    const dict = translations[lang] || translations.vi;
    return dict[key] || translations.vi[key] || key;
  };

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);