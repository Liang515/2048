# 2048 極致體驗版 🧩

一個基於 TypeScript、Tailwind CSS 與原生 DOM 開發的 2048 網頁遊戲。除了經典的 2048 玩法外，我們特別優化了行動裝置的使用體驗，並加入了豐富的視覺與音效特效，旨在打造極致的遊玩體驗。

👉 **[立即線上遊玩](https://2048-drab.vercel.app)**

---

## 🌟 特色亮點

### 📱 行動裝置完美優化 (Responsive Mobile UI)
* **空間黃金分配**：特別針對手機螢幕重新配置版面，將控制按鈕與 Logo 旁空位整合，消除不必要的留白，為棋盤爭取最大顯示空間。
* **原生手勢支援**：在螢幕任意位置滑動即可流暢移動方塊，無拘無束。
* **無 Emoji 質感按鈕**：操作按鈕（重來、上一步）全面採用簡約 SVG 向量圖示，完美融合精緻的設計語言。
* **自動置中對稱**：不論在何種比例的螢幕上，遊戲畫面皆會自動於垂直與水平方向優雅置中。

### 👴 長輩模式 (Senior Mode)
* **一鍵放大**：按「大字」按鈕，方塊數字、分數、按鈕與對話框文字全面放大，按鈕高度至少 56px，好看也好按。
* **高對比方塊**：調整淺色方塊的文字顏色與中高階方塊的飽和度，並加粗數字，降低辨識負擔。
* **設定記憶**：切換後會記在 `localStorage`；也可以直接分享 `?senior=1` 網址，打開就是長輩模式（`?senior=0` 關閉）。
* 本模式整合自原本獨立的 [senior-2048](https://github.com/Liang515/senior-2048) 專案。

### 🌓 智慧雙色主題 (Smart Dark Mode)
* **系統自動適應**：預設自動偵測您的作業系統主題（淺色/深色），並即時監聽系統偏好變更進行動態切換。
* **手動鎖定功能**：提供獨立的主題切換按鈕，一旦手動切換將會鎖定您的偏好（儲存於 `localStorage`），不受系統主題干擾。
* **元件完美同步**：Tailwind CSS 與自訂 CSS 變數全面同步，確保切換主題時，按鈕、下拉選單、計分板與彈出視窗皆一致變色。

### 🔊 互動音效與視覺特效
* **合成器音效 (Web Audio API)**：免載入外部音訊檔案！直接透過瀏覽器原生音訊合成器，產生存檔/滑動（低頻消逝）、合併（悅耳大三度和弦）、過關（琶音升調）與結束（悲傷減三和弦）等精緻音效。
* **勝利彩帶特效 (Confetti)**：成功拼湊出 2048 獲勝時，畫面將會噴灑出七彩繽紛的原生 Canvas 物理運動彩帶粒子。
* **動態浮動分數**：每次得分時，計分板上方將會彈出 `+X` 的浮動上升特效，反饋感十足。

### ⚙️ 完整遊戲系統
* **多棋盤尺寸**：支援 **3x3、4x4、5x5、6x6** 四種棋盤。
* **獨立存檔機制**：每種棋盤大小皆擁有**獨立的自動存檔**，關閉瀏覽器後再次打開即可繼續前一次的進度。
* **無限上一步 (Undo)**：支援無限次數的「上一步」回退，容錯率百分百！
* **本地排行榜**：自動記錄每種棋盤大小前五名的歷史最高分，並提供自訂名字輸入框以登入榮譽榜。

---

## 🛠️ 技術棧

* **建置工具**：Vite + TypeScript（strict 模式），不使用前端框架，畫面以原生 DOM 操作
* **樣式框架**：Tailwind CSS v4（建置時產生，`dark:` 以 `<html class="dark">` 切換）
* **核心邏輯**：`src/game/logic.ts` 為純函式（移動、合併、結束判斷、字級），以 Vitest 單元測試
* **音效處理**：Web Audio API Oscillator (振盪器) 與 Gain (增益節點)
* **動畫與特效**：HTML5 Canvas (Confetti) & CSS Keyframe 動畫
* **程式品質**：Biome（lint + format）
* **部署平台**：Vercel（`vercel.json` 指定 Vite 建置，輸出 `dist/`）

### 專案結構

```
index.html            頁面結構
public/               圖示與 Web App Manifest
src/main.ts           畫面操作、事件、遊戲流程
src/game/logic.ts     純遊戲邏輯（含測試 logic.test.ts）
src/storage.ts        localStorage 存取（存檔、排行榜、偏好設定）
src/effects/          音效與彩帶特效
src/style.css         Tailwind 與自訂樣式（主題色、長輩模式）
```

---

## 🚀 本地運行指引

需要 Node.js 20.19 以上（建議 22）。

```bash
git clone https://github.com/Liang515/2048.git
cd 2048
npm install
npm run dev        # 開發伺服器，http://localhost:5173
```

其他指令：

| 指令 | 用途 |
| --- | --- |
| `npm test` | 執行單元測試 |
| `npm run lint` | Biome 檢查 |
| `npm run format` | Biome 自動格式化 |
| `npm run build` | 型別檢查並建置到 `dist/` |
| `npm run preview` | 預覽建置結果 |

---

## 📜 授權與致敬 (Licensing & Attribution)

* 本專案基於 **[Gabriele Cirulli](https://github.com/gabrielecirulli/2048)** 的開源專案 《2048》 進行二次開發與最佳化。在此特別致謝原作者的開源貢獻。
* 原版遊戲概念與設計靈感源自 Asher Vollmer 的 **《Threes!》** 以及 Veewo Land 的 **《1024》**。
* 本專案採用 **[MIT License](file:///Users/liangchen/Downloads/2048/LICENSE)** 授權條款，您可以自由修改、散佈及使用此程式碼，惟請保留原始著作權宣告與授權許可聲明。
