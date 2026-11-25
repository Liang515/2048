import "./style.css";
import { ConfettiEffect } from "./effects/confetti";
import { SoundEngine } from "./effects/sound";
import { dateLabel, greeting, streakTitle, weekdayLabel } from "./game/greeting";
import {
  computeMove,
  type Direction,
  emptyCells,
  isGameOver,
  type MovableTile,
  type TileState,
  tileClasses,
  tileFontSize,
  tileGeometry,
} from "./game/logic";
import { dayKey, recentDays, recordGameEnd, recordScore, streak } from "./game/stats";
import type { SavedState } from "./storage";
import * as storage from "./storage";

interface DomTile extends MovableTile {
  el: HTMLDivElement;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const sfx = new SoundEngine(storage.prefs.getMuted());
const confetti = new ConfettiEffect($<HTMLCanvasElement>("confetti-canvas"));

let gridSize = 4;
let tiles: DomTile[] = [];
let score = 0;
let isOver = false;
let isWon = false;
let hasContinued = false;
let isAnimating = false;
let moveTimer: number | null = null;
let idCounter = 0;
let hasSavedThisRun = false;
let historyStack: SavedState[] = [];
/** 這局開始時的最高分；結束時分數超過它就是破紀錄 */
let runBest = 0;
/** 這局自動記到排行榜的那一筆（讓「改名字」知道要改哪一筆） */
let lastRecord: { name: string; score: number } | null = null;
let stats = storage.getStats();

const backgroundLayer = $("background-layer");
const tileLayer = $("tile-layer");
const leaderboardEls = document.querySelectorAll<HTMLUListElement>(".leaderboard-list");
const todayStatsEls = document.querySelectorAll<HTMLElement>(".today-stats");
const scoreValueEls = document.querySelectorAll<HTMLElement>("[data-score]");
const bestValueEls = document.querySelectorAll<HTMLElement>("[data-best]");
const resultDialog = $<HTMLDialogElement>("result-dialog");

/** 打開對話框，焦點放在視窗本身，避免第一個按鈕（例如 ×）出現藍色焦點框 */
function showDialog(dialog: HTMLDialogElement) {
  dialog.showModal();
  if (dialog.hasAttribute("autofocus")) dialog.focus();
}

// ---------- 主題 ----------
function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  document.body.classList.toggle("dark-mode", isDark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#0c0a09" : "#f5f5f4");
}

function initTheme() {
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const saved = storage.prefs.getTheme();
  applyTheme(saved === "dark" || (!saved && !!media?.matches));
  media?.addEventListener?.("change", (e) => {
    if (!storage.prefs.getTheme()) applyTheme(e.matches);
  });
}

function toggleTheme() {
  const isDark = !document.documentElement.classList.contains("dark");
  applyTheme(isDark);
  storage.prefs.setTheme(isDark ? "dark" : "light");
  syncSettings();
}

// ---------- 設定 ----------
function syncSettings() {
  const states: Record<string, boolean> = {
    sound: !sfx.muted,
    dark: document.documentElement.classList.contains("dark"),
  };
  for (const row of document.querySelectorAll<HTMLElement>("[data-setting]")) {
    row.setAttribute("aria-pressed", String(states[row.dataset.setting ?? ""] ?? false));
  }
  for (const btn of document.querySelectorAll<HTMLElement>(".size-btn")) {
    btn.setAttribute("aria-pressed", String(Number(btn.dataset.size) === gridSize));
  }
  $("setting-name").textContent = storage.prefs.getLastName() || "未設定";
}

function openSettings() {
  syncSettings();
  const canInstall = !isStandalone() && (!!installPrompt || window.matchMedia("(pointer: coarse)").matches || isIOS());
  $("install-setting").hidden = !canInstall;
  showDialog($<HTMLDialogElement>("settings-dialog"));
}

// ---------- 靜音 ----------
function toggleMute() {
  sfx.muted = !sfx.muted;
  storage.prefs.setMuted(sfx.muted);
  syncSettings();
}

// ---------- 盤面與方塊 ----------
// 棋盤在矮螢幕上會縮小，方塊數字跟著等比例縮小（以 360px 寬的棋盤為基準）
function tileFont(val: number): string {
  const width = $("game-container").clientWidth;
  const scale = width > 0 ? Math.min(1, width / 360) : 1;
  return `calc(${tileFontSize(val, gridSize, true)} * ${scale.toFixed(3)})`;
}

function refreshTileFonts() {
  for (const t of tiles) t.el.style.fontSize = tileFont(t.val);
}

function setPosition(el: HTMLElement, r: number, c: number) {
  Object.assign(el.style, tileGeometry(r, c, gridSize));
}

function initBoardBackground() {
  backgroundLayer.innerHTML = "";
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      setPosition(cell, r, c);
      backgroundLayer.appendChild(cell);
    }
  }
}

function createTile(val: number, r: number, c: number, isNew = false): DomTile {
  const el = document.createElement("div");
  el.classList.add("tile", ...tileClasses(val));
  if (isNew) el.classList.add("tile-new");
  el.style.fontSize = tileFont(val);
  el.textContent = String(val);
  setPosition(el, r, c);
  tileLayer.appendChild(el);

  const tile: DomTile = { id: `tile-${++idCounter}`, val, r, c, el };
  tiles.push(tile);
  if (isNew) setTimeout(() => el.classList.remove("tile-new"), 200);
  return tile;
}

function renderTiles(list: TileState[]) {
  tileLayer.innerHTML = "";
  tiles = [];
  for (const t of list) createTile(t.val, t.r, t.c);
}

function addRandomTile() {
  const empty = emptyCells(tiles, gridSize);
  if (empty.length === 0) return;
  const pos = empty[Math.floor(Math.random() * empty.length)];
  createTile(Math.random() < 0.9 ? 2 : 4, pos.r, pos.c, true);
}

/** 沒有步數可以退時，「上一步」顯示為不能按 */
function updateUndoButton() {
  $<HTMLButtonElement>("undo-btn").disabled = historyStack.length === 0;
}

function snapshot(): SavedState {
  return {
    score,
    isGameOver: isOver,
    isGameWon: isWon,
    hasContinued,
    tiles: tiles.map((t) => ({ val: t.val, r: t.r, c: t.c })),
  };
}

// ---------- 遊戲流程 ----------
function clearPendingTimers() {
  if (moveTimer !== null) {
    window.clearTimeout(moveTimer);
    moveTimer = null;
  }
  isAnimating = false;
}

function restartGame() {
  clearPendingTimers();
  // 中途重來也算玩了一局，分數也記到排行榜（遊戲結束時已經記過就不重複）
  if (score > 0 && !isOver) {
    saveStats(recordGameEnd(stats, dayKey(new Date()), score));
    recordToLeaderboard(score);
  }

  tiles = [];
  score = 0;
  isOver = false;
  isWon = false;
  hasContinued = false;
  hasSavedThisRun = false;
  historyStack = [];

  runBest = storage.getBest(gridSize);
  lastRecord = null;
  updateScore(0);
  resultDialog.close();
  tileLayer.innerHTML = "";

  addRandomTile();
  addRandomTile();

  storage.clearActiveGame(gridSize);
  updateUndoButton();
}

function undo() {
  if (isAnimating) return;
  const prev = historyStack.pop();
  if (!prev) return;
  clearPendingTimers();

  score = prev.score;
  isOver = prev.isGameOver;
  isWon = prev.isGameWon;
  hasContinued = prev.hasContinued;
  hasSavedThisRun = false;

  updateScore(score);
  resultDialog.close();
  renderTiles(prev.tiles);
  saveActiveGame();
}

function move(dir: Direction) {
  if (isAnimating || isOver) return;
  if (isWon && !hasContinued) return;

  const before = snapshot();
  const result = computeMove(tiles, gridSize, dir);
  if (!result.moved) return;

  isAnimating = true;
  for (const t of tiles) {
    const pos = result.positions.get(t.id);
    if (!pos) continue;
    t.r = pos.r;
    t.c = pos.c;
    setPosition(t.el, pos.r, pos.c);
  }

  historyStack.push(before);
  updateUndoButton();
  if (result.addedScore > 0) {
    updateScore(score + result.addedScore);
    sfx.playMerge();
    showScorePop(result.addedScore, visibleScoreEl());
  } else {
    sfx.playSlide();
  }
  saveStats(recordScore(stats, dayKey(new Date()), score));

  moveTimer = window.setTimeout(() => {
    moveTimer = null;
    const removed = new Set(result.removed);
    for (const t of tiles) if (removed.has(t.id)) t.el.remove();
    tiles = tiles.filter((t) => !removed.has(t.id));

    for (const m of result.merged) {
      const t = createTile(m.val, m.r, m.c);
      t.el.classList.add("tile-merged");
      setTimeout(() => t.el.classList.remove("tile-merged"), 200);
      if (m.val === 2048 && !hasContinued) isWon = true;
    }
    addRandomTile();

    if (isWon && !hasContinued) {
      showResult({ won: true });
    } else if (isGameOver(tiles, gridSize)) {
      isOver = true;
      saveStats(recordGameEnd(stats, dayKey(new Date()), score));
      showResult();
    }
    saveActiveGame();
    isAnimating = false;
  }, 100);
}

function continueGame() {
  hasContinued = true;
  saveActiveGame();
}

function changeGridSize(size: number) {
  if (size === gridSize) return;
  clearPendingTimers();
  gridSize = size;
  // 上一個棋盤的進度已存檔，不算中途放棄
  score = 0;
  isOver = false;
  tileLayer.innerHTML = "";
  tiles = [];
  historyStack = [];
  initBoardBackground();
  loadHighScores();
  if (!loadActiveGame()) restartGame();
  syncSettings();
}

// ---------- 分數與訊息 ----------
function showScorePop(amount: number, targetEl: HTMLElement) {
  if (amount <= 0) return;
  const parent = targetEl.parentElement;
  if (!parent) return;
  parent.classList.add("relative");
  const pop = document.createElement("span");
  pop.className =
    "absolute text-lg font-black pointer-events-none select-none z-50 text-green-500 animate-score-pop dark:text-green-400";
  pop.textContent = `+${amount}`;
  pop.style.left = "50%";
  pop.style.top = "10%";
  pop.style.transform = "translateX(-50%)";
  parent.appendChild(pop);
  setTimeout(() => pop.remove(), 600);
}

/** 目前畫面上看得到的分數元素（浮動 +分數 要跟著它） */
function visibleScoreEl(): HTMLElement {
  return [...scoreValueEls].find((el) => el.offsetParent !== null) ?? scoreValueEls[0];
}

function updateScore(s: number) {
  score = s;
  for (const el of scoreValueEls) el.textContent = score.toLocaleString();
  if (score > storage.getBest(gridSize)) {
    storage.setBest(gridSize, score);
    showBest(score);
  }
}

function showBest(best: number) {
  for (const el of bestValueEls) el.textContent = best.toLocaleString();
}

// ---------- 排行榜 ----------
/** 這一局開始之前的最高分（存檔有記就用；舊存檔沒有時，最高分若就是這局的分數則不算） */
function bestBeforeCurrentGame(best: number): number {
  const active = storage.loadActiveGame(gridSize);
  if (!active) return best;
  if (active.startBest !== undefined) return active.startBest;
  return active.score >= best ? 0 : best;
}

/** 沒有稱呼時排行榜上的名字 */
const DEFAULT_NAME = "我";

function loadHighScores() {
  const best = storage.getBest(gridSize);
  showBest(best);
  let list = storage.getLeaderboard(gridSize);
  // 舊版只有玩到「沒步可走」又有稱呼時才記排行榜；排行榜是空的就把「以前」的最高分補進去。
  // 最高分在玩的時候會即時更新，所以要扣掉正在玩的這一局，避免這局結束時又記一次
  const pastBest = bestBeforeCurrentGame(best);
  if (list.length === 0 && pastBest > 0) {
    list = [{ name: storage.prefs.getLastName() || DEFAULT_NAME, score: pastBest, date: "" }];
    storage.setLeaderboard(gridSize, list);
  }
  updateLeaderboardUI(list);
}

function qualifiesForLeaderboard(finalScore: number): boolean {
  if (finalScore <= 0) return false;
  const list = storage.getLeaderboard(gridSize);
  if (list.length < 5) return true;
  return finalScore > list[list.length - 1].score;
}

function promptForName(finalScore: number, renameFrom?: string) {
  const dialog = $<HTMLDialogElement>("name-entry-dialog");
  $("entry-score").textContent = String(finalScore);
  const nameInput = $<HTMLInputElement>("player-name-input");
  // 帶入上次的名字，長輩不必每次重打
  nameInput.value = storage.prefs.getLastName();

  const handleSave = () => {
    dialog.close();
    const name = nameInput.value.trim();
    if (name) storage.prefs.setLastName(name);
    if (renameFrom !== undefined) renameLeaderboardRecord(renameFrom, name || "匿名玩家", finalScore);
    else saveLeaderboardRecord(name || "匿名玩家", finalScore);
    lastRecord = { name: name || "匿名玩家", score: finalScore };
    renderGreeting();
    updateResultBoard();
  };
  // 用 onxxx 屬性覆寫，避免多次開啟時重複綁定
  $("btn-save-name").onclick = handleSave;
  nameInput.onkeydown = (e) => {
    if (e.key === "Enter") handleSave();
  };
  showDialog(dialog);
}

function saveLeaderboardRecord(name: string, finalScore: number) {
  const list = storage.getLeaderboard(gridSize);
  list.push({ name, score: finalScore, date: new Date().toLocaleDateString() });
  list.sort((a, b) => b.score - a.score);
  const top5 = list.slice(0, 5);
  storage.setLeaderboard(gridSize, top5);
  updateLeaderboardUI(top5);
}

function updateLeaderboardScore(record: { name: string; score: number }, newScore: number) {
  const list = storage.getLeaderboard(gridSize);
  const entry = list.find((e) => e.name === record.name && e.score === record.score);
  if (!entry) return;
  entry.score = newScore;
  list.sort((x, y) => y.score - x.score);
  storage.setLeaderboard(gridSize, list);
  updateLeaderboardUI(list);
}

/** 這局的分數記到排行榜；同一局記過就更新原本那一筆。有記上（或已在榜上）回傳 true */
function recordToLeaderboard(finalScore: number): boolean {
  if (lastRecord) {
    // 同一局按「上一步」後又結束：更新原本那一筆，不重複記
    if (finalScore > lastRecord.score) {
      updateLeaderboardScore(lastRecord, finalScore);
      lastRecord = { ...lastRecord, score: finalScore };
    }
    return true;
  }
  if (!qualifiesForLeaderboard(finalScore)) return false;
  const name = storage.prefs.getLastName() || DEFAULT_NAME;
  saveLeaderboardRecord(name, finalScore);
  lastRecord = { name, score: finalScore };
  return true;
}

function renameLeaderboardRecord(oldName: string, newName: string, finalScore: number) {
  const list = storage.getLeaderboard(gridSize);
  const entry = list.find((e) => e.name === oldName && e.score === finalScore);
  if (!entry) return;
  entry.name = newName;
  storage.setLeaderboard(gridSize, list);
  updateLeaderboardUI(list);
}

function clearLeaderboard() {
  showDialog($<HTMLDialogElement>("confirm-clear-dialog"));
}

function confirmClearOk() {
  $<HTMLDialogElement>("confirm-clear-dialog").close();
  storage.clearRecords(gridSize);
  // 紀錄清掉後，這局從零開始比，結束時才會正確判斷破紀錄
  runBest = 0;
  lastRecord = null;
  loadHighScores();
  saveActiveGame();
}

// ---------- 我的紀錄 ----------
function saveStats(next: typeof stats) {
  if (next === stats) return;
  stats = next;
  storage.setStats(stats);
  renderStats();
}

function statBox(label: string, value: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "stat";
  const l = document.createElement("div");
  l.className = "stat-label";
  l.textContent = label;
  const v = document.createElement("div");
  v.className = "stat-value";
  v.textContent = value;
  box.append(l, v);
  return box;
}

function renderStats() {
  const now = new Date();
  const today = stats[dayKey(now)];
  const days = streak(stats, now);

  let note = "今天還沒玩，來一局吧！";
  if (today && days >= 2) note = `已經連續玩 ${days} 天了，真棒！`;
  else if (today) note = "今天也有動動腦，很好！";

  for (const el of todayStatsEls) {
    const n = document.createElement("div");
    n.className = "stat-note";
    n.textContent = note;
    el.replaceChildren(
      statBox("今天玩了", `${today?.games ?? 0} 局`),
      statBox("今天最高", (today?.best ?? 0).toLocaleString()),
      statBox("連續天數", `${days} 天`),
      n,
    );
    el.classList.remove("hidden");
  }

  // 頂部的打卡卡片
  $("streak-title").textContent = streakTitle(days, !!today);
  $("streak-compact").textContent =
    days >= 2 && today ? `連續 ${days} 天・今天 ${today.games} 局` : streakTitle(days, !!today);
  $("streak-today").textContent = today
    ? `今天玩了 ${today.games} 局・今天最高 ${today.best.toLocaleString()} 分`
    : "今天還沒有紀錄";
  $("week-dots").replaceChildren(
    ...recentDays(stats, now).map((d) => {
      const day = document.createElement("span");
      day.className = "day";
      const dot = document.createElement("span");
      dot.className = `dot${d.played ? " on" : ""}${d.isToday ? " today" : ""}`;
      dot.textContent = d.played ? "✓" : "";
      const label = document.createElement("span");
      label.className = "day-label";
      label.textContent = d.isToday ? "今天" : weekdayLabel(d.weekday);
      day.append(dot, label);
      day.setAttribute("aria-label", `${label.textContent}${d.played ? "有玩" : "沒玩"}`);
      return day;
    }),
  );
}

// ---------- 問候語與稱呼 ----------
function renderGreeting() {
  const now = new Date();
  $("greeting").textContent = greeting(storage.prefs.getLastName(), now.getHours());
  $("today-date").textContent = dateLabel(now);
  $("setting-name").textContent = storage.prefs.getLastName() || "未設定";
}

let helloIsFirstRun = false;

function openHello() {
  $<HTMLDialogElement>("settings-dialog").close();
  const input = $<HTMLInputElement>("hello-name-input");
  input.value = storage.prefs.getLastName();
  input.onkeydown = (e) => {
    if (e.key === "Enter") saveHello();
  };
  showDialog($<HTMLDialogElement>("hello-dialog"));
}

function closeHello() {
  $<HTMLDialogElement>("hello-dialog").close();
}

// 不論按「好」「略過」、Esc 或 Android 返回鍵關掉，都記為問過
$<HTMLDialogElement>("hello-dialog").addEventListener("close", () => {
  storage.prefs.setNameAsked();
  renderGreeting();
  if (helloIsFirstRun) {
    helloIsFirstRun = false;
    maybeShowInstallHint();
  }
});

function saveHello() {
  storage.prefs.setLastName($<HTMLInputElement>("hello-name-input").value.trim());
  closeHello();
}

function openRecords() {
  $("records-size").textContent = `${gridSize}×${gridSize}`;
  showDialog($<HTMLDialogElement>("records-dialog"));
}

// ---------- 一局結束 ----------
function updateResultBoard() {
  const board = $("result-board");
  if (!lastRecord) return;
  board.hidden = false;
  $("result-board-text").textContent = `已經記到排行榜：${lastRecord.name}`;
  $("result-board-btn").textContent = "改名字";
}

function showResult({ won = false, quiet = false }: { won?: boolean; quiet?: boolean } = {}) {
  const now = new Date();
  const isRecord = score > runBest;
  const celebrate = won || isRecord;
  // 一局結束時已經記過這一局；過關時這局還在進行，要把它算進去
  const gamesSoFar = stats[dayKey(now)]?.games ?? 0;
  const games = won ? gamesSoFar + 1 : Math.max(gamesSoFar, 1);
  const days = streak(stats, now);

  $("result-badge").hidden = !celebrate;
  $("result-badge-text").textContent = won ? "拼出 2048 了！" : "新紀錄！";
  $("result-title").textContent = won ? "太厲害了！這局拿到" : isRecord ? "這局拿到" : "沒有地方可以動了";
  $("result-sub").hidden = celebrate;
  $("result-big").hidden = !celebrate;
  $("result-big").textContent = score.toLocaleString();
  $("result-gain").hidden = !isRecord;
  $("result-gain").textContent =
    runBest > 0
      ? `比之前的最高分 ${runBest.toLocaleString()} 多了 ${(score - runBest).toLocaleString()} 分，太厲害了！`
      : "這是你的第一個紀錄！";
  $("result-stats").hidden = celebrate;
  $("result-score").textContent = score.toLocaleString();
  $("result-games").textContent = String(games);
  $("result-streak").hidden = !celebrate;
  $("result-streak").textContent = days >= 2 ? `今天第 ${games} 局・連續玩 ${days} 天` : `今天第 ${games} 局`;

  // 過關時主要按鈕是「繼續挑戰」；沒步可走時是「上一步」
  const primary = $("result-primary");
  primary.dataset.action = won ? "continueResult" : "undoResult";
  primary.classList.toggle("no-icon", won);
  $("result-undo-label").textContent = won ? "繼續挑戰" : isRecord ? "上一步，繼續拚" : "上一步";

  // 擠進前五名就直接記上（沒有稱呼時先記成「我」，可以按「改名字」）
  const board = $("result-board");
  board.hidden = true;
  if (!hasSavedThisRun) {
    board.hidden = !recordToLeaderboard(score);
    hasSavedThisRun = true;
  }
  updateResultBoard();

  if (!resultDialog.open) showDialog(resultDialog);
  if (quiet) return;
  if (celebrate) {
    sfx.playVictory();
    confetti.start(won ? 4000 : 3000);
  } else {
    sfx.playGameOver();
  }
}

function renameRecord() {
  if (lastRecord) promptForName(lastRecord.score, lastRecord.name);
  else promptForName(score);
}

function updateLeaderboardUI(list: storage.LeaderboardEntry[]) {
  for (const el of leaderboardEls) {
    el.innerHTML = "";
    if (list.length === 0) {
      el.innerHTML = '<li class="text-center py-2 text-stone-400">尚無紀錄</li>';
      continue;
    }
    list.forEach((item, i) => {
      const li = document.createElement("li");
      li.className =
        "flex justify-between py-1.5 border-b border-stone-100 dark:border-stone-800 last:border-0 text-stone-600 dark:text-stone-300";
      li.innerHTML = `
        <div class="flex items-center gap-1.5">
          <span class="font-black text-stone-400 dark:text-stone-500">#${i + 1}</span>
          <span class="name font-semibold text-stone-700 dark:text-stone-200 truncate max-w-[100px]"></span>
        </div>
        <span class="font-bold text-stone-900 dark:text-white">${item.score.toLocaleString()}</span>`;
      // 玩家名字用 textContent，避免輸入內容被當成 HTML
      (li.querySelector(".name") as HTMLElement).textContent = item.name || "匿名玩家";
      el.appendChild(li);
    });
  }
  renderCardBoard(list);
}

/** 橫式版面打卡卡片裡的前三名（直向手機由 CSS 隱藏） */
function renderCardBoard(list: storage.LeaderboardEntry[]) {
  $("card-board-size").textContent = `${gridSize}×${gridSize}`;
  const span = (className: string, text: string) => {
    const el = document.createElement("span");
    el.className = className;
    el.textContent = text;
    return el;
  };
  const top3 = list.slice(0, 3);
  $("card-board-list").replaceChildren(
    ...(top3.length > 0
      ? top3.map((item, i) => {
          const row = span("card-board-row", "");
          row.append(
            span("card-board-rank", String(i + 1)),
            span("card-board-name", item.name || "匿名玩家"),
            span("card-board-score", item.score.toLocaleString()),
          );
          return row;
        })
      : [span("card-board-empty", "還沒有紀錄，玩完一局就會出現在這裡")]),
  );
}

// ---------- 存檔 ----------
function saveActiveGame() {
  updateUndoButton();
  storage.saveActiveGame(gridSize, { ...snapshot(), historyStack, startBest: runBest });
}

function loadActiveGame(): boolean {
  const state = storage.loadActiveGame(gridSize);
  if (!state) return false;

  score = state.score;
  isOver = state.isGameOver;
  isWon = state.isGameWon;
  hasContinued = state.hasContinued;
  historyStack = state.historyStack ?? [];
  // 載入已結束／已過關的存檔時不再重複跳出排行榜輸入框
  hasSavedThisRun = isOver || (isWon && !hasContinued);
  runBest = state.startBest ?? storage.getBest(gridSize);
  lastRecord = null;

  updateScore(score);
  renderTiles(state.tiles);
  updateUndoButton();

  // 重新載入已結束的局：照樣顯示結束畫面，但不再放音效與彩帶
  if (isOver) showResult({ quiet: true });
  else if (isWon && !hasContinued) showResult({ won: true, quiet: true });
  return true;
}

// ---------- 放到手機桌面（PWA） ----------
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
let installPrompt: InstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e as InstallPromptEvent;
});

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

function showInstall() {
  $<HTMLDialogElement>("settings-dialog").close();
  const ios = isIOS();
  const canPrompt = !ios && !!installPrompt;
  $("install-steps-ios").classList.toggle("hidden", !ios);
  $("install-steps-other").classList.toggle("hidden", ios || canPrompt);
  $("install-now-btn").classList.toggle("hidden", !canPrompt);
  $("install-dismiss-btn").textContent = canPrompt ? "不再提示" : "知道了";
  showDialog($<HTMLDialogElement>("install-dialog"));
}

async function installNow() {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  dismissInstall();
}

function dismissInstall() {
  storage.prefs.setInstallHintDismissed();
  $<HTMLDialogElement>("install-dialog").close();
}

// 用手機、還沒放到桌面、也還沒按過「知道了」時，主動提示一次
function maybeShowInstallHint() {
  if (isStandalone() || storage.prefs.getInstallHintDismissed()) return;
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  setTimeout(() => {
    if (!document.querySelector("dialog[open]")) showInstall();
  }, 1500);
}

// ---------- 對話框 ----------
function toggleRules() {
  const dialog = $<HTMLDialogElement>("rules-dialog");
  if (dialog.open) dialog.close();
  else showDialog(dialog);
}

function confirmRestart() {
  if (score > 0) showDialog($<HTMLDialogElement>("confirm-restart-dialog"));
  else restartGame();
}

// 尚未支援 closedby="any" 的瀏覽器（如 Safari），補上點對話框外面背景時關閉
function initDialogDismissFallback() {
  if ("closedBy" in HTMLDialogElement.prototype) return;
  for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[closedby="any"]')) {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!inside) dialog.close();
    });
  }
}

// ---------- 輸入 ----------
const actions: Record<string, () => void> = {
  toggleMute,
  toggleTheme,
  toggleRules,
  confirmRestart,
  undo,
  clearLeaderboard,
  openSettings,
  openRecords,
  openHello,
  saveHello,
  skipHello: closeHello,
  renameRecord,
  undoResult: () => {
    resultDialog.close();
    undo();
  },
  continueResult: () => {
    resultDialog.close();
    continueGame();
  },
  restartResult: () => {
    resultDialog.close();
    restartGame();
  },
  confirmClearOk,
  showInstall,
  installNow: () => void installNow(),
  dismissInstall,
  laterInstall: () => $<HTMLDialogElement>("install-dialog").close(),
  confirmRestartOk: () => {
    $<HTMLDialogElement>("confirm-restart-dialog").close();
    restartGame();
  },
};

document.addEventListener("click", (e) => {
  const el = e.target as HTMLElement;
  const action = el.closest<HTMLElement>("[data-action]")?.dataset.action;
  if (action) actions[action]?.();
  const size = el.closest<HTMLElement>("[data-size]")?.dataset.size;
  if (size) changeGridSize(Number(size));
});

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

document.addEventListener("keydown", (e) => {
  const dir = KEY_MAP[e.code];
  if (dir) {
    e.preventDefault();
    move(dir);
  }
});

// 整個畫面都能滑；從按鈕上開始滑也算滑動（不會觸發按鈕）
let touchStart: { x: number; y: number; onControl: boolean } | null = null;
let suppressClickUntil = 0;

function swipeAllowedFrom(target: EventTarget | null): boolean {
  if (document.querySelector("dialog[open]")) return false;
  if (!(target instanceof Element)) return false;
  return !target.closest("input, select, textarea");
}

document.addEventListener(
  "touchstart",
  (e) => {
    // 幽靈點擊只會發生在放開手指的當下；下一次摸螢幕時就不再擋，避免吃掉真正的點擊
    suppressClickUntil = 0;
    const target = e.target;
    touchStart =
      e.touches.length === 1 && swipeAllowedFrom(target)
        ? {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            onControl: target instanceof Element && !!target.closest("button, a, label"),
          }
        : null;
  },
  { passive: true },
);
document.addEventListener(
  "touchmove",
  (e) => {
    if (touchStart) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener("touchend", (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) {
    // 從按鈕上開始的滑動：方塊照動，但接下來的點擊不算數，避免誤按「上一步」或「重來」
    if (touchStart.onControl) suppressClickUntil = performance.now() + 600;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  }
  touchStart = null;
});
window.addEventListener(
  "click",
  (e) => {
    if (performance.now() < suppressClickUntil) {
      suppressClickUntil = 0;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);
document.addEventListener("touchcancel", () => {
  touchStart = null;
});

window.addEventListener("resize", refreshTileFonts);

// App 隔夜放在背景，切回來時「今天」要換成新的一天
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    renderStats();
    renderGreeting();
  }
});

// ---------- 啟動 ----------
initTheme();
initBoardBackground();
loadHighScores();
initDialogDismissFallback();
renderStats();
renderGreeting();
syncSettings();
if (!loadActiveGame()) restartGame();

// 第一次打開先問稱呼（以前破紀錄時填過名字就不用再問），之後才提示放到桌面
if (storage.prefs.getLastName()) storage.prefs.setNameAsked();
if (!storage.prefs.getNameAsked() && !document.querySelector("dialog[open]")) {
  helloIsFirstRun = true;
  openHello();
} else {
  maybeShowInstallHint();
}
