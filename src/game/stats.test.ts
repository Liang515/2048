import { describe, expect, it } from "vitest";
import { dayKey, recentDays, recordGameEnd, recordScore, type Stats, streak } from "./stats";

describe("dayKey", () => {
  it("用本地日期補零", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("recordScore / recordGameEnd", () => {
  it("記錄今天最高分，不會往下掉", () => {
    let s: Stats = {};
    s = recordScore(s, "2026-11-25", 100);
    s = recordScore(s, "2026-11-25", 50);
    expect(s["2026-11-25"]).toEqual({ games: 0, best: 100 });
  });

  it("分數沒變時回傳同一個物件（不必重存）", () => {
    const s = recordScore({}, "2026-11-25", 100);
    expect(recordScore(s, "2026-11-25", 80)).toBe(s);
  });

  it("一局結束時局數加一", () => {
    let s: Stats = {};
    s = recordGameEnd(s, "2026-11-25", 300);
    s = recordGameEnd(s, "2026-11-25", 200);
    expect(s["2026-11-25"]).toEqual({ games: 2, best: 300 });
  });

  it("只保留最近 400 天", () => {
    let s: Stats = {};
    const start = new Date(2025, 0, 1);
    for (let i = 0; i < 410; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      s = recordScore(s, dayKey(d), 10);
    }
    expect(Object.keys(s)).toHaveLength(400);
    expect(s["2025-01-01"]).toBeUndefined();
  });
});

describe("streak", () => {
  const today = new Date(2026, 10, 25);
  const days = (...keys: string[]): Stats => Object.fromEntries(keys.map((k) => [k, { games: 1, best: 0 }]));

  it("從今天往回數連續天數", () => {
    expect(streak(days("2026-11-25", "2026-11-24", "2026-11-23", "2026-11-21"), today)).toBe(3);
  });

  it("今天還沒玩，從昨天開始算", () => {
    expect(streak(days("2026-11-24", "2026-11-23"), today)).toBe(2);
  });

  it("昨天也沒玩就是 0", () => {
    expect(streak(days("2026-11-22"), today)).toBe(0);
  });

  it("跨月也能算", () => {
    expect(streak(days("2026-12-01", "2026-11-30"), new Date(2026, 11, 1))).toBe(2);
  });
});

describe("recentDays", () => {
  it("以今天為最後一天，往回七天，標出有玩的日子", () => {
    const stats: Stats = { "2026-11-25": { games: 1, best: 0 }, "2026-11-23": { games: 2, best: 0 } };
    const days = recentDays(stats, new Date(2026, 10, 25));
    expect(days).toHaveLength(7);
    expect(days[0].key).toBe("2026-11-19");
    expect(days[6]).toEqual({ key: "2026-11-25", weekday: 3, played: true, isToday: true });
    expect(days.filter((d) => d.played).map((d) => d.key)).toEqual(["2026-11-23", "2026-11-25"]);
  });

  it("跨月", () => {
    expect(recentDays({}, new Date(2026, 11, 2)).map((d) => d.key)[0]).toBe("2026-11-26");
  });
});
