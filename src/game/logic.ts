// 純遊戲邏輯：不碰 DOM、不碰 localStorage，方便單元測試

export type Direction = "up" | "down" | "left" | "right";

export interface TileState {
  val: number;
  r: number;
  c: number;
}

export interface MovableTile extends TileState {
  id: string;
}

export interface MoveResult {
  moved: boolean;
  addedScore: number;
  /** 每個方塊移動後的位置（含即將被合併掉的方塊，動畫要先滑過去再移除） */
  positions: Map<string, { r: number; c: number }>;
  /** 參與合併、動畫結束後要移除的方塊 id */
  removed: string[];
  /** 合併產生的新方塊 */
  merged: TileState[];
}

const VECTORS: Record<Direction, { r: number; c: number }> = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 },
};

type Cell = { id: string; val: number; isMerged: boolean } | null;

export function computeMove(tiles: readonly MovableTile[], size: number, dir: Direction): MoveResult {
  const vector = VECTORS[dir];
  // 先處理靠近移動方向邊緣的方塊
  const ordered = [...tiles].sort((a, b) => {
    if (dir === "right") return b.c - a.c;
    if (dir === "left") return a.c - b.c;
    if (dir === "down") return b.r - a.r;
    return a.r - b.r;
  });

  const grid: Cell[][] = Array.from({ length: size }, () => Array<Cell>(size).fill(null));
  for (const t of ordered) grid[t.r][t.c] = { id: t.id, val: t.val, isMerged: false };

  const result: MoveResult = { moved: false, addedScore: 0, positions: new Map(), removed: [], merged: [] };

  for (const tile of ordered) {
    let nextR = tile.r;
    let nextC = tile.c;
    let mergeInto = false;

    while (true) {
      const checkR = nextR + vector.r;
      const checkC = nextC + vector.c;
      if (checkR < 0 || checkR >= size || checkC < 0 || checkC >= size) break;
      const obstacle = grid[checkR][checkC];
      if (!obstacle) {
        nextR = checkR;
        nextC = checkC;
      } else {
        if (obstacle.val === tile.val && !obstacle.isMerged) {
          nextR = checkR;
          nextC = checkC;
          mergeInto = true;
        }
        break;
      }
    }

    if (nextR === tile.r && nextC === tile.c) continue;

    result.moved = true;
    result.positions.set(tile.id, { r: nextR, c: nextC });
    grid[tile.r][tile.c] = null;

    if (mergeInto) {
      const target = grid[nextR][nextC] as NonNullable<Cell>;
      const newVal = tile.val * 2;
      result.addedScore += newVal;
      result.removed.push(tile.id, target.id);
      result.merged.push({ val: newVal, r: nextR, c: nextC });
      grid[nextR][nextC] = { id: `merged-${nextR}-${nextC}`, val: newVal, isMerged: true };
    } else {
      grid[nextR][nextC] = { id: tile.id, val: tile.val, isMerged: false };
    }
  }

  return result;
}

export function emptyCells(tiles: readonly TileState[], size: number): { r: number; c: number }[] {
  const occupied = new Set(tiles.map((t) => `${t.r},${t.c}`));
  const empty: { r: number; c: number }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!occupied.has(`${r},${c}`)) empty.push({ r, c });
    }
  }
  return empty;
}

export function isGameOver(tiles: readonly TileState[], size: number): boolean {
  if (tiles.length < size * size) return false;
  const g: number[][] = Array.from({ length: size }, () => Array<number>(size).fill(0));
  for (const t of tiles) g[t.r][t.c] = t.val;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = g[r][c];
      if (r < size - 1 && g[r + 1][c] === v) return false;
      if (c < size - 1 && g[r][c + 1] === v) return false;
    }
  }
  return true;
}

/** 依棋盤大小與數值字數動態計算字型大小，避免小數字過小或大數字溢出 */
export function tileFontSize(val: number, size: number, senior: boolean): string {
  const len = val.toString().length;
  let baseSize = 2.5; // 預設 4x4
  if (size === 3) baseSize = 3.2;
  else if (size === 5) baseSize = 1.9;
  else if (size === 6) baseSize = 1.5;

  let scale = 1.0;
  if (len === 3) scale = 0.8;
  else if (len === 4) scale = 0.65;
  else if (len >= 5) scale = 0.5;

  // 長輩模式：整體放大，但多位數時壓縮比例以免溢出方塊
  if (senior) {
    baseSize *= 1.2;
    if (len === 3) scale = 0.75;
    else if (len === 4) scale = 0.58;
    else if (len >= 5) scale = 0.45;
  }

  return `${baseSize * scale}rem`;
}

/** 方塊的顏色 class；超過 2048 統一使用 tile-higher */
export function tileClasses(val: number): string[] {
  return val > 2048 ? [`tile-${val}`, "tile-higher"] : [`tile-${val}`];
}

/** 方塊在盤面中的位置與大小（CSS calc 字串） */
export function tileGeometry(r: number, c: number, size: number) {
  const gap = size >= 5 ? 8 : 12;
  const padding = 12;
  const dim = `calc((100% - ${(size - 1) * gap + 2 * padding}px) / ${size})`;
  return {
    width: dim,
    height: dim,
    left: `calc(${padding}px + ${c} * (100% + ${gap - 2 * padding}px) / ${size})`,
    top: `calc(${padding}px + ${r} * (100% + ${gap - 2 * padding}px) / ${size})`,
  };
}
