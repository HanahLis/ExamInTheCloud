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
  countryName: 'Quốc tế',
  flag: '',
  colors: {
    primary: '#4f46e5', // Soft Royal Indigo
    primaryHover: '#4338ca',
    accent: '#8b5cf6',
    badgeBg: '#eef2ff',
    badgeText: '#4338ca',
  },
};
