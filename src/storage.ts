// localStorage 包裝：鍵名沿用舊版，既有玩家的存檔與排行榜不受影響
import type { TileState } from "./game/logic";
import type { Stats } from "./game/stats";

export interface SavedState {
  score: number;
  isGameOver: boolean;
  isGameWon: boolean;
  hasContinued: boolean;
  tiles: TileState[];
}

export interface ActiveGame extends SavedState {
  historyStack: SavedState[];
  /** 這局開始時的最高分，用來判斷結束時是否破紀錄（舊存檔沒有這個欄位） */
  startBest?: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 無痕模式或儲存空間被封鎖時直接略過
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // 同上
  }
}

export const prefs = {
  getMuted: () => get("2048_muted") === "true",
  setMuted: (v: boolean) => set("2048_muted", String(v)),
  /** 'dark' | 'light' | null（null 代表跟隨系統） */
  getTheme: () => get("2048_theme"),
  setTheme: (v: "dark" | "light") => set("2048_theme", v),
  getLastName: () => get("2048_last_name") ?? "",
  setLastName: (v: string) => set("2048_last_name", v),
  /** 第一次打開時問過「要怎麼稱呼你」了沒（略過也算問過） */
  getNameAsked: () => get("2048_name_asked") === "true",
  setNameAsked: () => set("2048_name_asked", "true"),
  getInstallHintDismissed: () => get("2048_install_hint_dismissed") === "true",
  setInstallHintDismissed: () => set("2048_install_hint_dismissed", "true"),
};

export function getStats(): Stats {
  try {
    const stats = JSON.parse(get("2048_stats") ?? "{}");
    return stats && typeof stats === "object" && !Array.isArray(stats) ? stats : {};
  } catch {
    return {};
  }
}

export function setStats(stats: Stats): void {
  set("2048_stats", JSON.stringify(stats));
}

export function getBest(size: number): number {
  return Number.parseInt(get(`2048_best_${size}`) ?? "0", 10) || 0;
}

export function setBest(size: number, score: number): void {
  set(`2048_best_${size}`, String(score));
}

export function getLeaderboard(size: number): LeaderboardEntry[] {
  try {
    const list = JSON.parse(get(`2048_list_${size}`) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function setLeaderboard(size: number, list: LeaderboardEntry[]): void {
  set(`2048_list_${size}`, JSON.stringify(list));
}

export function clearRecords(size: number): void {
  remove(`2048_list_${size}`);
  remove(`2048_best_${size}`);
}

export function loadActiveGame(size: number): ActiveGame | null {
  const raw = get(`2048_active_game_${size}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveGame;
  } catch (e) {
    console.error("載入存檔失敗:", e);
    return null;
  }
}

export function saveActiveGame(size: number, game: ActiveGame): void {
  set(`2048_active_game_${size}`, JSON.stringify(game));
}

export function clearActiveGame(size: number): void {
  remove(`2048_active_game_${size}`);
}
