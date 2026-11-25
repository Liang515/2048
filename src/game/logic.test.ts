import { describe, expect, it } from "vitest";
import {
  computeMove,
  type Direction,
  emptyCells,
  isGameOver,
  type MovableTile,
  tileClasses,
  tileFontSize,
} from "./logic";

/** 用 0 表示空格的二維陣列建立方塊 */
function fromGrid(grid: number[][]): MovableTile[] {
  const tiles: MovableTile[] = [];
  grid.forEach((row, r) => {
    row.forEach((val, c) => {
      if (val) tiles.push({ id: `${r}-${c}`, val, r, c });
    });
  });
  return tiles;
}

/** 套用移動結果後的盤面 */
function applyMove(grid: number[][], dir: Direction): { grid: number[][]; score: number; moved: boolean } {
  const size = grid.length;
  const tiles = fromGrid(grid);
  const res = computeMove(tiles, size, dir);
  const out = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const removed = new Set(res.removed);
  for (const t of tiles) {
    if (removed.has(t.id)) continue;
    const pos = res.positions.get(t.id) ?? t;
    out[pos.r][pos.c] = t.val;
  }
  for (const m of res.merged) out[m.r][m.c] = m.val;
  return { grid: out, score: res.addedScore, moved: res.moved };
}

describe("computeMove", () => {
  it("把方塊滑到底", () => {
    expect(
      applyMove(
        [
          [0, 2, 0, 4],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        "left",
      ).grid[0],
    ).toEqual([2, 4, 0, 0]);
  });

  it("相同數字合併並加分", () => {
    const res = applyMove(
      [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      "left",
    );
    expect(res.grid[0]).toEqual([4, 0, 0, 0]);
    expect(res.score).toBe(4);
  });

  it("一次移動中，合併出的方塊不會再合併", () => {
    expect(
      applyMove(
        [
          [2, 2, 4, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        "left",
      ).grid[0],
    ).toEqual([4, 4, 0, 0]);
    expect(
      applyMove(
        [
          [4, 4, 4, 4],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        "left",
      ).grid[0],
    ).toEqual([8, 8, 0, 0]);
  });

  it("三個相同時，靠移動方向那側的兩個先合併", () => {
    expect(
      applyMove(
        [
          [2, 2, 2, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        "right",
      ).grid[0],
    ).toEqual([0, 0, 2, 4]);
    expect(
      applyMove(
        [
          [2, 2, 2, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        "left",
      ).grid[0],
    ).toEqual([4, 2, 0, 0]);
  });

  it("上下方向也正確", () => {
    const grid = [
      [2, 0, 0],
      [2, 0, 4],
      [4, 0, 4],
    ];
    expect(applyMove(grid, "up").grid).toEqual([
      [4, 0, 8],
      [4, 0, 0],
      [0, 0, 0],
    ]);
    expect(applyMove(grid, "down").grid).toEqual([
      [0, 0, 0],
      [4, 0, 0],
      [4, 0, 8],
    ]);
  });

  it("無法移動時 moved 為 false", () => {
    const res = applyMove(
      [
        [2, 4, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      "left",
    );
    expect(res.moved).toBe(false);
    expect(res.score).toBe(0);
  });

  it("合併時兩個舊方塊都標記為移除，且都滑到合併位置", () => {
    const tiles = fromGrid([
      [0, 0],
      [8, 8],
    ]);
    const res = computeMove(tiles, 2, "right");
    expect(res.removed.sort()).toEqual(["1-0", "1-1"]);
    expect(res.positions.get("1-0")).toEqual({ r: 1, c: 1 });
    expect(res.merged).toEqual([{ val: 16, r: 1, c: 1 }]);
  });
});

describe("isGameOver", () => {
  it("還有空格就沒結束", () => {
    expect(
      isGameOver(
        fromGrid([
          [2, 4],
          [8, 0],
        ]),
        2,
      ),
    ).toBe(false);
  });

  it("滿格但還能合併就沒結束", () => {
    expect(
      isGameOver(
        fromGrid([
          [2, 4],
          [2, 8],
        ]),
        2,
      ),
    ).toBe(false);
  });

  it("滿格且無法合併就結束", () => {
    expect(
      isGameOver(
        fromGrid([
          [2, 4],
          [8, 16],
        ]),
        2,
      ),
    ).toBe(true);
  });
});

describe("emptyCells", () => {
  it("列出所有空格", () => {
    expect(
      emptyCells(
        fromGrid([
          [2, 0],
          [0, 4],
        ]),
        2,
      ),
    ).toEqual([
      { r: 0, c: 1 },
      { r: 1, c: 0 },
    ]);
  });
});

describe("tileFontSize", () => {
  it("一般模式沿用舊的字級", () => {
    expect(tileFontSize(2, 4, false)).toBe("2.5rem");
    expect(tileFontSize(1024, 4, false)).toBe(`${2.5 * 0.65}rem`);
    expect(tileFontSize(8, 3, false)).toBe("3.2rem");
  });

  it("長輩模式放大，但多位數會壓縮", () => {
    expect(tileFontSize(2, 4, true)).toBe("3rem");
    expect(tileFontSize(1024, 4, true)).toBe(`${3 * 0.58}rem`);
  });
});

describe("tileClasses", () => {
  it("超過 2048 才套用 tile-higher", () => {
    expect(tileClasses(2048)).toEqual(["tile-2048"]);
    expect(tileClasses(4096)).toEqual(["tile-4096", "tile-higher"]);
  });
});
