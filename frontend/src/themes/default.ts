export interface AppTheme {
  id: string;
  name: string;
  countryName: string;
  flag: string;
  colors: {
    primary: string;
    primaryHover: string;
    accent: string;
    badgeBg: string;
    badgeText: string;
  };
}

export const defaultTheme: AppTheme = {
  id: 'default',
  name: 'default',
  countryName: 'Chuẩn Quốc Tế',
  flag: '🌐',
  colors: {
    primary: '#2563EB', // Blue 600
    primaryHover: '#1D4ED8', // Blue 700
    accent: '#4F46E5', // Indigo 600
    badgeBg: '#DBEAFE', // Blue 100
    badgeText: '#1E40AF', // Blue 800
  },
};
