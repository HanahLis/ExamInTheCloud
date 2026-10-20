import React, { createContext, useContext, useState, useEffect } from 'react';
import { defaultTheme, type AppTheme } from './default';
import { vnTheme } from './vn';
import { laTheme } from './la';

export const AVAILABLE_THEMES: Record<string, AppTheme> = {
  vn: vnTheme,
  la: laTheme,
  default: defaultTheme,
};

interface ThemeContextType {
  theme: AppTheme;
  themeName: string;
  setThemeName: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  themeName: 'default',
  setThemeName: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeName, setThemeName] = useState<string>(() => {
    return localStorage.getItem('cloudexam_theme') || 'vn';
  });

  // Cơ chế Graceful Fallback về defaultTheme nếu không tìm thấy theme
  const currentTheme = AVAILABLE_THEMES[themeName] || defaultTheme;

  useEffect(() => {
    localStorage.setItem('cloudexam_theme', themeName);
    document.documentElement.style.setProperty('--color-primary', currentTheme.colors.primary);
    document.documentElement.style.setProperty('--color-primary-hover', currentTheme.colors.primaryHover);
    document.documentElement.style.setProperty('--color-accent', currentTheme.colors.accent);
  }, [themeName, currentTheme]);

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, themeName, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
