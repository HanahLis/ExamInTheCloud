import { defaultTheme, type AppTheme } from './default';

export const laTheme: AppTheme = {
  ...defaultTheme,
  id: 'la',
  name: 'la',
  countryName: 'Lào (Lao PDR)',
  flag: '🇱🇦',
  colors: {
    primary: '#0284C7', // Sky 600
    primaryHover: '#0369A1', // Sky 700
    accent: '#DC2626', // Red 600
    badgeBg: '#E0F2FE', // Sky 100
    badgeText: '#075985', // Sky 800
  },
};
