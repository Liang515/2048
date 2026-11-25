import "./style.css";
import { ConfettiEffect } from "./effects/confetti";
import { SoundEngine } from "./effects/sound";
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
import { dayKey, recordGameEnd, recordScore, streak } from "./game/stats";
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
let idCounter = 0;
let hasSavedThisRun = false;
let isSenior = false;
let historyStack: SavedState[] = [];
let stats = storage.getStats();

const backgroundLayer = $("background-layer");
const tileLayer = $("tile-layer");
const scoreEl = $("score");
const scoreMobileEl = $("score-mobile");
const bestScoreEl = $("best-score");
const bestScoreMobileEl = $("best-score-mobile");
const messageDialog = $<HTMLDialogElement>("message-dialog");
const messageTitle = $("message-title");
const messageScore = $("message-score");
const btnContinue = $("btn-continue");
const leaderboardEls = document.querySelectorAll<HTMLUListElement>(".leaderboard-list");
const todayStatsEls = document.querySelectorAll<HTMLElement>(".today-stats");

// ---------- 主題 ----------
function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  document.body.classList.toggle("dark-mode", isDark);
  updateThemeIcon(isDark);
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

const SUN_ICON = `
  <circle cx="12" cy="12" r="5"></circle>
  <line x1="12" y1="1" x2="12" y2="3"></line>
  <line x1="12" y1="21" x2="12" y2="23"></line>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
  <line x1="1" y1="12" x2="3" y2="12"></line>
  <line x1="21" y1="12" x2="23" y2="12"></line>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
const MOON_ICON = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;

function updateThemeIcon(isDark: boolean) {
  for (const id of ["theme-icon", "theme-icon-mobile"]) {
    const icon = document.getElementById(id);
    if (icon) icon.innerHTML = isDark ? MOON_ICON : SUN_ICON;
  }
}

// ---------- 長輩模式（原 senior-2048）----------
// 第一次打開預設開啟；網址帶 ?senior=1 或 ?senior=0 時會覆寫並記住設定
function initSenior() {
  const param = new URLSearchParams(location.search).get("senior");
  if (param === "1" || param === "0") storage.prefs.setSenior(param === "1");
  applySenior(storage.prefs.getSenior() ?? true);
}

function toggleSenior() {
  applySenior(!isSenior);
  storage.prefs.setSenior(isSenior);
}

function applySenior(on: boolean) {
  isSenior = on;
  document.body.classList.toggle("senior-mode", on);
  for (const btn of document.querySelectorAll(".senior-btn")) btn.setAttribute("aria-pressed", String(on));
  for (const t of tiles) t.el.style.fontSize = tileFontSize(t.val, gridSize, isSenior);
  syncSettings();
}

// ---------- 設定 ----------
function syncSettings() {
  const states: Record<string, boolean> = {
    senior: isSenior,
    sound: !sfx.muted,
    dark: document.documentElement.classList.contains("dark"),
  };
  for (const row of document.querySelectorAll<HTMLElement>("[data-setting]")) {
    row.setAttribute("aria-pressed", String(states[row.dataset.setting ?? ""] ?? false));
  }
  for (const btn of document.querySelectorAll<HTMLElement>(".size-btn")) {
    btn.setAttribute("aria-pressed", String(Number(btn.dataset.size) === gridSize));
  }
  $<HTMLSelectElement>("grid-size-select").value = String(gridSize);
}

function openSettings() {
  syncSettings();
  $("install-setting").hidden = isStandalone();
  $<HTMLDialogElement>("settings-dialog").showModal();
}

// ---------- 靜音 ----------
const SOUND_ON_ICON = `
  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
const SOUND_OFF_ICON = `
  <line x1="1" y1="1" x2="23" y2="23"></line>
  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>`;

function toggleMute() {
  sfx.muted = !sfx.muted;
  storage.prefs.setMuted(sfx.muted);
  updateMuteIcon(sfx.muted);
  syncSettings();
}

function updateMuteIcon(isMuted: boolean) {
  for (const id of ["mute-icon", "mute-icon-mobile"]) {
    const icon = document.getElementById(id);
    if (icon) icon.innerHTML = isMuted ? SOUND_OFF_ICON : SOUND_ON_ICON;
  }
}

// ---------- 盤面與方塊 ----------
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
  el.style.fontSize = tileFontSize(val, gridSize, isSenior);
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
function restartGame() {
  // 中途重來也算玩了一局（遊戲結束時已經記過就不重複）
  if (score > 0 && !isOver) saveStats(recordGameEnd(stats, dayKey(new Date()), score));

  tiles = [];
  score = 0;
  isOver = false;
  isWon = false;
  hasContinued = false;
  isAnimating = false;
  hasSavedThisRun = false;
  historyStack = [];

  updateScore(0);
  messageDialog.close();
  btnContinue.classList.add("hidden-custom");
  tileLayer.innerHTML = "";

  addRandomTile();
  addRandomTile();

  storage.clearActiveGame(gridSize);
}

function undo() {
  if (isAnimating) return;
  const prev = historyStack.pop();
  if (!prev) return;

  score = prev.score;
  isOver = prev.isGameOver;
  isWon = prev.isGameWon;
  hasContinued = prev.hasContinued;
  hasSavedThisRun = false;

  updateScore(score);
  messageDialog.close();
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
  if (result.addedScore > 0) {
    updateScore(score + result.addedScore);
    sfx.playMerge();
    showScorePop(result.addedScore, scoreEl);
  } else {
    sfx.playSlide();
  }
  saveStats(recordScore(stats, dayKey(new Date()), score));

  setTimeout(() => {
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
      showMessage("恭喜過關!", score, true);
      sfx.playVictory();
      confetti.start(4000);
    } else if (isGameOver(tiles, gridSize)) {
      isOver = true;
      saveStats(recordGameEnd(stats, dayKey(new Date()), score));
      showMessage("遊戲結束", score, false);
      sfx.playGameOver();
    }
    saveActiveGame();
    isAnimating = false;
  }, 100);
}

function continueGame() {
  hasContinued = true;
  messageDialog.close();
}

function changeGridSize(size: number) {
  if (size === gridSize) return;
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

function updateScore(s: number) {
  score = s;
  scoreEl.textContent = String(score);
  scoreMobileEl.textContent = String(score);
  if (score > storage.getBest(gridSize)) {
    storage.setBest(gridSize, score);
    showBest(score);
  }
}

function showBest(best: number) {
  bestScoreEl.textContent = String(best);
  bestScoreMobileEl.textContent = String(best);
}

function showMessage(title: string, s: number, isWin: boolean) {
  messageTitle.textContent = title;
  messageScore.textContent = `得分: ${s}`;
  if (!messageDialog.open) messageDialog.showModal();
  btnContinue.classList.toggle("hidden-custom", !isWin);

  if (!hasSavedThisRun) {
    if (qualifiesForLeaderboard(s)) setTimeout(() => promptForName(s), 650);
    hasSavedThisRun = true;
  }
}

// ---------- 排行榜 ----------
function loadHighScores() {
  showBest(storage.getBest(gridSize));
  updateLeaderboardUI(storage.getLeaderboard(gridSize));
}

function qualifiesForLeaderboard(finalScore: number): boolean {
  const list = storage.getLeaderboard(gridSize);
  if (list.length < 5) return true;
  return finalScore > list[list.length - 1].score;
}

function promptForName(finalScore: number) {
  const dialog = $<HTMLDialogElement>("name-entry-dialog");
  $("entry-score").textContent = String(finalScore);
  const nameInput = $<HTMLInputElement>("player-name-input");
  // 帶入上次的名字，長輩不必每次重打
  nameInput.value = storage.prefs.getLastName();

  const handleSave = () => {
    dialog.close();
    const name = nameInput.value.trim();
    if (name) storage.prefs.setLastName(name);
    saveLeaderboardRecord(name || "匿名玩家", finalScore);
  };
  // 用 onxxx 屬性覆寫，避免多次開啟時重複綁定
  $("btn-save-name").onclick = handleSave;
  nameInput.onkeydown = (e) => {
    if (e.key === "Enter") handleSave();
  };
  dialog.showModal();
}

function saveLeaderboardRecord(name: string, finalScore: number) {
  const list = storage.getLeaderboard(gridSize);
  list.push({ name, score: finalScore, date: new Date().toLocaleDateString() });
  list.sort((a, b) => b.score - a.score);
  const top5 = list.slice(0, 5);
  storage.setLeaderboard(gridSize, top5);
  updateLeaderboardUI(top5);
}

function clearLeaderboard() {
  $<HTMLDialogElement>("confirm-clear-dialog").showModal();
}

function confirmClearOk() {
  $<HTMLDialogElement>("confirm-clear-dialog").close();
  storage.clearRecords(gridSize);
  loadHighScores();
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
      statBox("今天最高", String(today?.best ?? 0)),
      statBox("連續天數", `${days} 天`),
      n,
    );
    el.classList.remove("hidden");
  }
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
        <span class="font-bold text-stone-900 dark:text-white">${item.score}</span>`;
      // 玩家名字用 textContent，避免輸入內容被當成 HTML
      (li.querySelector(".name") as HTMLElement).textContent = item.name || "匿名玩家";
      el.appendChild(li);
    });
  }
}

// ---------- 存檔 ----------
function saveActiveGame() {
  storage.saveActiveGame(gridSize, { ...snapshot(), historyStack });
}

function loadActiveGame(): boolean {
  const state = storage.loadActiveGame(gridSize);
  if (!state) return false;

  score = state.score;
  isOver = state.isGameOver;
  isWon = state.isGameWon;
  hasContinued = state.hasContinued;
  historyStack = state.historyStack ?? [];
  hasSavedThisRun = false;

  updateScore(score);
  renderTiles(state.tiles);

  if (isOver) showMessage("遊戲結束", score, false);
  else if (isWon && !hasContinued) showMessage("恭喜過關!", score, true);
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
  $("install-steps-ios").classList.toggle("hidden", !ios);
  $("install-steps-other").classList.toggle("hidden", ios || !!installPrompt);
  $("install-now-btn").classList.toggle("hidden", ios || !installPrompt);
  $<HTMLDialogElement>("install-dialog").showModal();
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

// 長輩模式、用手機、還沒放到桌面、也還沒按過「知道了」時，主動提示一次
function maybeShowInstallHint() {
  if (!isSenior || isStandalone() || storage.prefs.getInstallHintDismissed()) return;
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  setTimeout(() => {
    if (!document.querySelector("dialog[open]")) showInstall();
  }, 1500);
}

// ---------- 對話框 ----------
function toggleRules() {
  const dialog = $<HTMLDialogElement>("rules-dialog");
  if (dialog.open) dialog.close();
  else dialog.showModal();
}

function confirmRestart() {
  if (score > 0) $<HTMLDialogElement>("confirm-restart-dialog").showModal();
  else restartGame();
}

// 點對話框外面的背景時關閉（名字輸入框除外）
function initDialogDismissFallback() {
  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog || dialog.id === "name-entry-dialog") return;
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
  toggleSenior,
  toggleRules,
  confirmRestart,
  undo,
  clearLeaderboard,
  continueGame,
  undoDialog: () => {
    messageDialog.close();
    undo();
  },
  restartGameDialog: () => {
    messageDialog.close();
    restartGame();
  },
  openSettings,
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

$<HTMLSelectElement>("grid-size-select").addEventListener("change", (e) => {
  changeGridSize(Number.parseInt((e.target as HTMLSelectElement).value, 10));
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

// 一般模式只在棋盤上滑動；長輩模式整個畫面都能滑（從「我的紀錄」開始滑則照常捲動頁面）
let touchStart: { x: number; y: number } | null = null;
const gameContainer = $("game-container");

function swipeAllowedFrom(target: EventTarget | null): boolean {
  if (document.querySelector("dialog[open]")) return false;
  if (!(target instanceof Element)) return false;
  if (gameContainer.contains(target)) return true;
  return isSenior && !target.closest(".records-area");
}

document.addEventListener(
  "touchstart",
  (e) => {
    touchStart =
      e.touches.length === 1 && swipeAllowedFrom(e.target)
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
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
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  }
  touchStart = null;
});

// App 隔夜放在背景，切回來時「今天」要換成新的一天
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderStats();
});

// ---------- 啟動 ----------
initTheme();
initSenior();
updateMuteIcon(sfx.muted);
initBoardBackground();
loadHighScores();
initDialogDismissFallback();
renderStats();
syncSettings();
if (!loadActiveGame()) restartGame();
maybeShowInstallHint();
