/** Money is stored as integer minor units. Never floats. */

export const toMinor = (major: number) => Math.round(major * 100);
export const toMajor = (minor: number) => minor / 100;

const grouped = (n: number, style: 'indian' | 'international') => {
  const [int, dec] = n.toFixed(2).split('.');
  const neg = int.startsWith('-');
  const digits = neg ? int.slice(1) : int;
  let out: string;
  if (style === 'indian' && digits.length > 3) {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  } else {
    out = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return { text: (neg ? '-' : '') + out, dec };
};

export function formatMoney(
  minor: number,
  opts: { symbol?: string; style?: 'indian' | 'international'; decimals?: boolean; compact?: boolean } = {}
) {
  const symbol = opts.symbol ?? '₹';
  const style = opts.style ?? 'indian';
  const value = toMajor(minor);

  if (opts.compact) {
    const abs = Math.abs(value);
    if (style === 'indian') {
      if (abs >= 1e7) return `${symbol}${(value / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
      if (abs >= 1e5) return `${symbol}${(value / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
      if (abs >= 1e3) return `${symbol}${(value / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
    } else {
      if (abs >= 1e9) return `${symbol}${(value / 1e9).toFixed(1)}B`;
      if (abs >= 1e6) return `${symbol}${(value / 1e6).toFixed(1)}M`;
      if (abs >= 1e3) return `${symbol}${(value / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
    }
    return `${symbol}${Math.round(value)}`;
  }

  const { text, dec } = grouped(value, style);
  const showDec = opts.decimals ?? dec !== '00';
  return `${symbol}${text}${showDec ? '.' + dec : ''}`;
}

/* -------------------------- dates -------------------------- */

export const pad2 = (n: number) => (n < 10 ? '0' + n : String(n));

/** Local calendar date as YYYY-MM-DD — never UTC. */
export function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const todayLocal = () => toLocalDate(new Date());

export function fromLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export const addDays = (s: string, n: number) => {
  const d = fromLocalDate(s);
  d.setDate(d.getDate() + n);
  return toLocalDate(d);
};

export const monthKey = (s: string) => s.slice(0, 7);

export const monthStart = (ym: string) => `${ym}-01`;

export function monthEnd(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return toLocalDate(new Date(y, m, 0));
}

export function daysInMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function monthLabel(ym: string, short = false) {
  const [y, m] = ym.split('-').map(Number);
  return `${(short ? MONTHS_SHORT : MONTHS)[m - 1]} ${y}`;
}

export function dayLabel(s: string) {
  const today = todayLocal();
  if (s === today) return 'Today';
  if (s === addDays(today, -1)) return 'Yesterday';
  if (s === addDays(today, 1)) return 'Tomorrow';
  const d = fromLocalDate(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
}

export function shortDayLabel(s: string) {
  const today = todayLocal();
  if (s === today) return 'Today';
  if (s === addDays(today, -1)) return 'Yest';
  const d = fromLocalDate(s);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export const currentMonth = () => monthKey(todayLocal());

/** Inclusive day span between two local dates. */
export function daySpan(from: string, to: string) {
  const ms = fromLocalDate(to).getTime() - fromLocalDate(from).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export const pct = (part: number, whole: number) => (whole <= 0 ? 0 : (part / whole) * 100);
