import React, { createContext, useContext, useState } from 'react';
import { defaultTheme } from './default';
import { vnTheme } from './vn';
import { laTheme } from './la';

const themes = { default: defaultTheme, vn: vnTheme, la: laTheme };

const ThemeContext = createContext({
  theme: defaultTheme,
  setThemeName: () => {}
});

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState('vn');

  // Cơ chế Graceful Fallback về bản default nếu không tìm thấy theme tương ứng
  const currentTheme = themes[themeName] || defaultTheme;

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, setThemeName }}>
      <div style={{ '--primary-color': currentTheme.colors.primary }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);