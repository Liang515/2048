import { describe, expect, it } from "vitest";
import { dateLabel, greeting, streakTitle, weekdayLabel } from "./greeting";

describe("greeting", () => {
  it("依時段換問候語", () => {
    expect(greeting("", 7)).toBe("早安");
    expect(greeting("", 11)).toBe("午安");
    expect(greeting("", 17)).toBe("午安");
    expect(greeting("", 18)).toBe("晚安");
    expect(greeting("", 2)).toBe("晚安");
  });

  it("有名字時加在前面，沒名字（或只有空白）時只有問候語", () => {
    expect(greeting("小明", 14)).toBe("小明，午安");
    expect(greeting("  ", 14)).toBe("午安");
  });
});

describe("dateLabel / weekdayLabel", () => {
  it("顯示月、日、星期", () => {
    expect(dateLabel(new Date(2026, 10, 25))).toBe("11 月 25 日 星期三");
    expect(weekdayLabel(0)).toBe("日");
  });
});

describe("streakTitle", () => {
  it("連續兩天以上顯示天數", () => {
    expect(streakTitle(5, true)).toBe("已經連續玩 5 天");
  });
  it("今天第一天玩", () => {
    expect(streakTitle(1, true)).toBe("今天開始動動腦");
  });
  it("昨天有玩、今天還沒玩", () => {
    expect(streakTitle(1, false)).toBe("昨天有玩，今天繼續吧");
  });
  it("最近都沒玩", () => {
    expect(streakTitle(0, false)).toBe("今天還沒玩，來一局吧");
  });
});
