import { useColorScheme } from 'react-native';
import { useSettings } from './store';

/**
 * Matches web/src/app/globals.css.
 *
 * The accent is indigo, deliberately a long way from both semantic hues: teal
 * means money in, rose means money out, so the brand colour must never be
 * mistaken for either. Light mode is a cool neutral scale — a warm grey made
 * every button and chip look muddy.
 */
export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  raised: string;
  sunken: string;
  line: string;
  lineSoft: string;
  lineStrong: string;
  ink: string;
  dim: string;
  faint: string;
  brand: string;
  brandSoft: string;
  onBrand: string;
  up: string;
  upSoft: string;
  down: string;
  downSoft: string;
  info: string;
  warn: string;
};

const dark: Theme = {
  dark: true,
  bg: '#0A0B10',
  surface: '#14161F',
  raised: '#1B1E29',
  sunken: '#0F111A',
  line: '#242838',
  lineSoft: '#1A1D29',
  lineStrong: '#343A4E',
  ink: '#F1F3F9',
  dim: '#98A0B4',
  faint: '#646C82',
  brand: '#7B7BF5',
  brandSoft: '#1C1C3A',
  onBrand: '#FFFFFF',
  up: '#2DD4A7',
  upSoft: '#0D2E26',
  down: '#FF5C7C',
  downSoft: '#331420',
  info: '#5B8DEF',
  warn: '#F5A524',
};

const light: Theme = {
  dark: false,
  bg: '#F7F8FB',
  surface: '#FFFFFF',
  raised: '#FFFFFF',
  sunken: '#F0F2F7',
  line: '#E3E7F0',
  lineSoft: '#EDEFF5',
  lineStrong: '#C7CEDD',
  ink: '#111420',
  dim: '#576074',
  faint: '#8892A6',
  brand: '#4F46D6',
  brandSoft: '#EAE9FD',
  onBrand: '#FFFFFF',
  up: '#0B9B78',
  upSoft: '#D8F5EC',
  down: '#D43A5F',
  downSoft: '#FCE3E8',
  info: '#3567CF',
  warn: '#B4740B',
};

export function useTheme(): Theme {
  const system = useColorScheme();
  const pref = useSettings((s) => s.themeMode);
  if (pref === 'dark') return dark;
  if (pref === 'light') return light;
  return system === 'light' ? light : dark;
}

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export { CATEGORY_COLORS } from './colors';
