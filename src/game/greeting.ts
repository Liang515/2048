// 長輩模式頂部的問候語與日期

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS[weekday];
}

/** 早安（5–11 點）、午安（11–18 點）、晚安（其他時間）；有名字時加在前面 */
export function greeting(name: string, hour: number): string {
  const word = hour >= 5 && hour < 11 ? "早安" : hour >= 11 && hour < 18 ? "午安" : "晚安";
  const trimmed = name.trim();
  return trimmed ? `${trimmed}，${word}` : word;
}

/** 例：11 月 25 日 星期三 */
export function dateLabel(date: Date): string {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 星期${WEEKDAYS[date.getDay()]}`;
}

/** 打卡卡片的標題 */
export function streakTitle(days: number, playedToday: boolean): string {
  if (days >= 2) return `已經連續玩 ${days} 天`;
  if (playedToday) return "今天開始動動腦";
  if (days === 1) return "昨天有玩，今天繼續吧";
  return "今天還沒玩，來一局吧";
}
