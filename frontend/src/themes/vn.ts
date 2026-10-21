import { defaultTheme, type AppTheme } from './default';

export const vnTheme: AppTheme = {
  ...defaultTheme,
  id: 'vn',
  name: 'vn',
  countryName: 'Việt Nam',
  flag: '',
  colors: {
    primary: '#0f172a', // Slate 900
    primaryHover: '#1e293b',
    accent: '#334155',
    badgeBg: '#f8fafc',
    badgeText: '#0f172a',
  },
};
