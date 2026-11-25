/**
 * Habitudes d'entraînement, calculées dans le fuseau horaire du navigateur.
 * Les jours de la semaine sont indexés du lundi (0) au dimanche (6).
 */

export interface Streak {
  days: number;
  start: string;
  end: string;
}

export interface DayCount {
  date: string;
  solves: number;
}

export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export interface Activity {
  activeDays: number;
  longestStreak: Streak | null;
  perMonth: number[];
  perWeekday: number[];
  /** heatmap[jour][heure] = nombre de solves. */
  heatmap: number[][];
  busiestDay: DayCount | null;
  favoriteWeekday: number | null;
  /** Part des solves entre 22 h et minuit (carte 11). */
  lateEveningShare: number;
  dominantPeriod: DayPeriod | null;
  periodShare: Record<DayPeriod, number>;
}

export function localDateKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function weekdayIndex(ts: number): number {
  return (new Date(ts).getDay() + 6) % 7;
}

export function periodOf(hour: number): DayPeriod {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

export function computeActivity(timestamps: readonly number[]): Activity {
  const perMonth = Array<number>(12).fill(0);
  const perWeekday = Array<number>(7).fill(0);
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const perDay = new Map<string, number>();
  const periods: Record<DayPeriod, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  let late = 0;

  for (const ts of timestamps) {
    const d = new Date(ts);
    const hour = d.getHours();
    const wd = weekdayIndex(ts);
    perMonth[d.getMonth()]!++;
    perWeekday[wd]!++;
    heatmap[wd]![hour]!++;
    periods[periodOf(hour)]++;
    if (hour >= 22) late++;
    const key = localDateKey(ts);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  const n = timestamps.length;
  const days = [...perDay.keys()].sort();

  let busiestDay: DayCount | null = null;
  for (const [date, solves] of perDay) {
    if (!busiestDay || solves > busiestDay.solves) busiestDay = { date, solves };
  }

  const periodShare = Object.fromEntries(
    Object.entries(periods).map(([k, v]) => [k, n ? v / n : 0]),
  ) as Record<DayPeriod, number>;

  return {
    activeDays: days.length,
    longestStreak: longestStreak(days),
    perMonth,
    perWeekday,
    heatmap,
    busiestDay,
    favoriteWeekday: n ? argMax(perWeekday) : null,
    lateEveningShare: n ? late / n : 0,
    dominantPeriod: n ? (argMaxKey(periods) as DayPeriod) : null,
    periodShare,
  };
}

/** Plus longue suite de jours consécutifs, à partir de dates YYYY-MM-DD triées. */
export function longestStreak(sortedDays: readonly string[]): Streak | null {
  if (sortedDays.length === 0) return null;
  let best: Streak = { days: 1, start: sortedDays[0]!, end: sortedDays[0]! };
  let curStart = sortedDays[0]!;
  let cur = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    if (dayDiff(sortedDays[i - 1]!, sortedDays[i]!) === 1) cur++;
    else {
      cur = 1;
      curStart = sortedDays[i]!;
    }
    if (cur > best.days) best = { days: cur, start: curStart, end: sortedDays[i]! };
  }
  return best;
}

function dayDiff(a: string, b: string): number {
  // Calcul en UTC pour ne pas être piégé par les changements d'heure.
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function argMax(values: readonly number[]): number {
  let best = 0;
  values.forEach((v, i) => {
    if (v > values[best]!) best = i;
  });
  return best;
}

function argMaxKey(rec: Record<string, number>): string {
  return Object.entries(rec).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}
