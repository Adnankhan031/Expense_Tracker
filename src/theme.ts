import { useColorScheme } from 'react-native';
import { useSettings } from './store';

export type Theme = {
  dark: boolean;
  bg: string;
  bgElev: string;
  card: string;
  cardAlt: string;
  line: string;
  lineStrong: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  warn: string;
  info: string;
  income: string;
  shadow: string;
};

const dark: Theme = {
  dark: true,
  bg: '#0B0F14',
  bgElev: '#111721',
  card: '#151D28',
  cardAlt: '#1B2634',
  line: '#232E3D',
  lineStrong: '#31404F',
  text: '#EDF3F9',
  textDim: '#93A2B4',
  textFaint: '#5E6E80',
  accent: '#3DDC97',
  accentSoft: '#12352A',
  onAccent: '#05130D',
  danger: '#FF7A7A',
  dangerSoft: '#3A1C1F',
  warn: '#FFB454',
  info: '#63A9FF',
  income: '#3DDC97',
  shadow: '#000000',
};

const light: Theme = {
  dark: false,
  bg: '#F4F7F9',
  bgElev: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#EDF1F5',
  line: '#DFE6ED',
  lineStrong: '#C6D2DD',
  text: '#0D1620',
  textDim: '#586878',
  textFaint: '#8B9AA9',
  accent: '#0FA968',
  accentSoft: '#D9F5E8',
  onAccent: '#FFFFFF',
  danger: '#D64545',
  dangerSoft: '#FBE4E4',
  warn: '#B27200',
  info: '#2C74D6',
  income: '#0FA968',
  shadow: '#0D1620',
};

export function useTheme(): Theme {
  const system = useColorScheme();
  const pref = useSettings((s) => s.themeMode);
  if (pref === 'dark') return dark;
  if (pref === 'light') return light;
  return system === 'light' ? light : dark;
}

export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const font = {
  regular: undefined as string | undefined,
  numeric: {
    fontVariant: ['tabular-nums'] as const,
  },
};

/** 16 distinct, muted-vivid hues that stay legible on both grounds. */
export const CATEGORY_COLORS = [
  '#FF8A65', '#4FC3F7', '#FFD54F', '#81C784', '#BA68C8',
  '#F06292', '#4DB6AC', '#9575CD', '#FFB74D', '#7986CB',
  '#A1887F', '#90A4AE', '#E57373', '#64B5F6', '#AED581',
  '#FF7043',
];
