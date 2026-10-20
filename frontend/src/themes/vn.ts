import { defaultTheme, type AppTheme } from './default';

export const vnTheme: AppTheme = {
  ...defaultTheme,
  id: 'vn',
  name: 'vn',
  countryName: 'Việt Nam',
  flag: '🇻🇳',
  colors: {
    primary: '#DC2626', // Red 600
    primaryHover: '#B91C1C', // Red 700
    accent: '#F59E0B', // Amber 500
    badgeBg: '#FEE2E2', // Red 100
    badgeText: '#991B1B', // Red 800
  },
};
