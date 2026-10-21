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
    primary: '#1e293b', // Slate 800 - thanh lịch, nhã nhặn
    primaryHover: '#0f172a',
    accent: '#475569',
    badgeBg: '#f1f5f9',
    badgeText: '#334155',
  },
};
