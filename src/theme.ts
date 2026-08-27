import { useColorScheme } from 'react-native';
import { useSettings } from './store';

/**
 * Matches web/src/app/globals.css. Warm near-black ground with a gold primary,
 * and separate semantic hues so a number's direction reads before the number does.
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
  bg: '#0A0B0F',
  surface: '#13151C',
  raised: '#1B1E27',
  sunken: '#0E1015',
  line: '#232733',
  lineSoft: '#1A1E28',
  lineStrong: '#333949',
  ink: '#F2F4F8',
  dim: '#969DB0',
  faint: '#626A7D',
  brand: '#FFB020',
  brandSoft: '#2E2208',
  onBrand: '#1A1200',
  up: '#2DD4A7',
  upSoft: '#0D2E26',
  down: '#FF5C7C',
  downSoft: '#331420',
  info: '#5B8DEF',
  warn: '#FFB020',
};

const light: Theme = {
  dark: false,
  bg: '#F6F6F3',
  surface: '#FFFFFF',
  raised: '#FFFFFF',
  sunken: '#EEEEEA',
  line: '#E3E3DD',
  lineSoft: '#EDEDEA',
  lineStrong: '#CDCDC5',
  ink: '#14161C',
  dim: '#5B626E',
  faint: '#8C93A0',
  brand: '#A86C00',
  brandSoft: '#FDF0D6',
  onBrand: '#FFFFFF',
  up: '#0B9B78',
  upSoft: '#D8F5EC',
  down: '#D43A5F',
  downSoft: '#FCE3E8',
  info: '#3567CF',
  warn: '#A86C00',
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
