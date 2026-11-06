import { defaultTheme, type AppTheme } from './default';

export const vnTheme: AppTheme = {
  ...defaultTheme,
  id: 'vn',
  name: 'vn',
  countryName: 'Việt Nam',
  flag: '',
  colors: {
    primary: '#0284c7', // Soft Educational Sky Blue
    primaryHover: '#0369a1',
    accent: '#0d9488', // Soft Teal
    badgeBg: '#f0f9ff',
    badgeText: '#0369a1',
  },
};
