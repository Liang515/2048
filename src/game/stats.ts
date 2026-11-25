// 每日遊玩紀錄：今天玩了幾局、今天最高分、連續玩了幾天

export interface DayRecord {
  /** 今天結束的局數 */
  games: number;
  /** 今天出現過的最高分 */
  best: number;
}

/** 以 YYYY-MM-DD（本地時間）為鍵 */
export type Stats = Record<string, DayRecord>;

const KEEP_DAYS = 400;

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function prune(stats: Stats): Stats {
  const keys = Object.keys(stats).sort();
  if (keys.length <= KEEP_DAYS) return stats;
  const kept: Stats = {};
  for (const k of keys.slice(-KEEP_DAYS)) kept[k] = stats[k];
  return kept;
}

/** 有移動就算今天有玩，並更新今天最高分 */
export function recordScore(stats: Stats, day: string, score: number): Stats {
  const today = stats[day] ?? { games: 0, best: 0 };
  if (stats[day] && score <= today.best) return stats;
  return prune({ ...stats, [day]: { ...today, best: Math.max(today.best, score) } });
}

/** 一局結束 */
export function recordGameEnd(stats: Stats, day: string, score: number): Stats {
  const today = stats[day] ?? { games: 0, best: 0 };
  return prune({ ...stats, [day]: { games: today.games + 1, best: Math.max(today.best, score) } });
}

/** 連續有玩的天數（今天還沒玩時，從昨天往回算，避免一早打開就顯示中斷） */
export function streak(stats: Stats, today: Date): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!stats[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (stats[dayKey(cursor)]) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export interface DayDot {
  key: string;
  /** 0 = 星期日 */
  weekday: number;
  played: boolean;
  isToday: boolean;
}

/** 以今天為最後一天，往回 n 天的遊玩狀態（打卡圓點用） */
export function recentDays(stats: Stats, today: Date, n = 7): DayDot[] {
  const days: DayDot[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = dayKey(d);
    days.push({ key, weekday: d.getDay(), played: !!stats[key], isToday: i === 0 });
  }
  return days;
}
