import { MONTHS_SHORT, addDays, daysInMonth, fromLocalDate, monthKey, monthLabel, pad2, shiftMonth } from './format';

/**
 * A "money month" that starts on payday rather than the 1st.
 *
 * Nothing is stored per cycle — every transaction keeps its local_date and the
 * boundaries are computed — so changing the start day re-buckets all history
 * immediately, and changing it back is lossless.
 */

/** The cycle anchor inside a given month, clamped to months that are too short. */
function anchorIn(ym: string, startDay: number): string {
  return `${ym}-${pad2(Math.min(Math.max(1, startDay), daysInMonth(ym)))}`;
}

/** First day of the cycle that `date` falls inside. */
export function cycleStartFor(date: string, startDay: number): string {
  if (startDay <= 1) return `${monthKey(date)}-01`;
  const here = anchorIn(monthKey(date), startDay);
  return date >= here ? here : anchorIn(shiftMonth(monthKey(date), -1), startDay);
}

/** Move a cycle start forward or back by whole cycles. */
export function shiftCycle(cycleStart: string, delta: number, startDay: number): string {
  if (startDay <= 1) return `${shiftMonth(monthKey(cycleStart), delta)}-01`;
  return anchorIn(shiftMonth(monthKey(cycleStart), delta), startDay);
}

/** Last day of the cycle, i.e. the day before the next one begins. */
export function cycleEndFor(cycleStart: string, startDay: number): string {
  return addDays(shiftCycle(cycleStart, 1, startDay), -1);
}

/** "25 Aug" — a bare day and month, with no "Today" substitution. */
export function dayMonth(date: string): string {
  const d = fromLocalDate(date);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "August 2026" on a calendar cycle, "25 Aug – 24 Sep" otherwise. */
export function cycleLabel(cycleStart: string, startDay: number): string {
  if (startDay <= 1) return monthLabel(monthKey(cycleStart));
  return `${dayMonth(cycleStart)} – ${dayMonth(cycleEndFor(cycleStart, startDay))}`;
}

/** Short form for chart axes: "Aug" or "25 Aug". */
export function cycleShortLabel(cycleStart: string, startDay: number): string {
  if (startDay <= 1) return MONTHS_SHORT[+cycleStart.slice(5, 7) - 1];
  return dayMonth(cycleStart);
}

/** The cycle containing today. */
export function currentCycle(today: string, startDay: number): string {
  return cycleStartFor(today, startDay);
}

/** The cycle that begins inside a given calendar month — used by the picker. */
export function cycleStartingIn(ym: string, startDay: number): string {
  return startDay <= 1 ? `${ym}-01` : anchorIn(ym, startDay);
}

export const CYCLE_DEFAULT = 1;
