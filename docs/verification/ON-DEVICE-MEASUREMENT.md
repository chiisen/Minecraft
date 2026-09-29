# 實機 GPU 效能量測（issue #8 / PRD §21）

本專案的截圖驗證（`npm run screenshots`）跑在 **headless Chromium + SwiftShader**，
那是 CPU 軟體渲染，**FPS / Frame Time 完全沒有參考價值**——它量到的是你的 CPU，
不是顯示卡。

本文件說明怎麼在**真實 GPU** 上量測。**本專案已用此流程完成驗收**（Apple M6，
1920×1080，全 Case 60 FPS 無掉幀），結果見 [`report-gpu.json`](report-gpu.json)
與 [`README.md`](README.md) 的「實機 GPU 效能」段落。

------------------------------------------------------------------------

## 快速開始（建議用這個）

```bash
npm install
npx playwright install chromium   # 首次需要下載瀏覽器
npm run bench:gpu
```

`tools/bench-gpu.mjs` 會自動完成：

1. 啟動 vite dev server（port 5198）
2. 驗證真的拿到硬體加速（**若退回軟體渲染會直接中止**，避免產出無效報告）
3. 以 1920×1080 跑完 9 個 Case，每個 Case 暖身 1.5 秒後取樣 3 次、**回報中位數**
4. 跑**兩輪**：
   - **Pass 1 — vsync 鎖定**：反映真實使用體驗，對應 PRD §21 的 60 FPS 驗收
   - **Pass 2 — 解除 vsync / 刷新率上限**：量 GPU 實際能跑多快，看**離瓶頸還有多遠**
5. 輸出 `docs/verification/report-gpu.json`

原始數據：

| Pass | 用途 | 怎麼判讀 |
|---|---|---|
| Pass 1（vsync 鎖定） | PRD §21 驗收 | 每幀 16.6 ms 恰為 60 Hz 整數倍，59.7~60.4 的落差是雜訊不是掉幀 |
| Pass 2（解除上限） | 看效能餘裕 | **個位數不可逐筆比較**（雜訊大），只看數量級 |

> **為什麼要跑兩輪？** 只報 60 FPS 會被螢幕刷新率天花板吃掉，看不出離瓶頸多遠。
> Pass 2 才能回答「Hidden Face Removal / LOD 這些還值不值得做」——
> 這是 PRD §19 Rule 6「只解決實際量測到的瓶頸」的判斷依據。

------------------------------------------------------------------------

## 環境要求

| 項目 | 建議 |
|---|---|
| 作業系統 | Windows 10/11、macOS 13+、或主流 Linux 桌機 |
| GPU | 一般消費級獨立或內顯皆可（PRD §21 目標是「一般消費級電腦」） |
| 瀏覽器 | Chromium（Playwright 自帶）。Chrome / Edge 可用於手動量測 |
| 解析度 | 腳本固定 1920×1080（PRD §21 指定） |
| 其他 | 量測時關閉其他吃 GPU 的程式（遊戲、影片播放、視訊會議） |

> 請一併記下 **GPU 型號**。腳本會自動把 renderer 字串寫進
> `report-gpu.json`（例如 `ANGLE (Apple, ANGLE Metal Renderer: Apple M6)`）。

### 各平台的 GPU 啟用方式

Headless Chromium **不加參數時一律退回 SwiftShader**。腳本已依平台處理：

| 平台 | 參數 |
|---|---|
| macOS | `--use-angle=metal` |
| Windows | `--use-angle=d3d11` |
| Linux | `--ignore-gpu-blocklist`（走預設 Vulkan/GL） |

若腳本報「偵測到軟體渲染」，代表該平台沒拿到 GPU。可改用 headed 模式：

```js
// tools/bench-gpu.mjs
browser = await chromium.launch({ headless: false, args: gpuArgs() });
```

------------------------------------------------------------------------

## 手動量測（想用 Debug UI 親自看）

```bash
npm run dev
```

開啟瀏覽器進入它印出來的網址（預設 `http://localhost:5173`）。

畫面左上角是 **stats.js 面板**（FPS / MS / MB），右上角是 **lil-gui Debug UI**。

### 設定量測情境

| Case | Ant Count | Flower Count | 其他 |
|---|---:|---:|---|
| A | 100 | 50 | 預設 |
| B | 1,000 | 50 | 預設 |
| C | 10,000 | 50 | 預設 |
| C' | 10,000 | 50 | **額外**：Shadows = ON（issue #8 的重點） |

操作步驟（每個 Case 重複一次 ON / OFF）：

1. `Scene → Ant Count` 設成 100 / 1,000 / 10,000
   （或點 Scene 資料夾裡的 `100 Ants` / `1,000 Ants` / `10,000 Ants` 三個預設鈕）
2. `Scene → Flower Count` 設 **50**
3. `Rendering → Instancing` 切成 **ON**，記下數字
4. `Rendering → Instancing` 切成 **OFF**，記下數字
5. （只在 Case C 做）`Rendering → Shadows` 切成 **ON**，再記一次

> **Instancing OFF 的安全上限**：關掉 Instancing 後程式會把螞蟻數**自動限制在 1,000 隻**
> （`MAX_NON_INSTANCED_ANTS`），這是 PRD §15「不得故意造成頁面崩潰」的要求。
> 所以 10,000 隻在 OFF 模式下實際只會畫 1,000 隻，這是**預期行為**，不是 bug。

### 要記錄的數值

Debug UI 的 `Performance` 區塊已經即時顯示：

| 欄位 | 來源 | 說明 |
|---|---|---|
| FPS | 自己計算 | 由 Frame Time 換算而來 |
| Frame Time (ms) | 自己計算 | 指數平滑後的值 |
| Triangles | `renderer.info.render.triangles` | 整幀總量，含場景其他物件 |
| **Vertices** | 場景遍歷（frustum culling 後） | PRD §15 要求的欄位 |
| Draw Calls | `renderer.info.render.calls` | 與 GPU 後端無關 |
| Objects | 場景遍歷 | Mesh / InstancedMesh 總數 |
| Visible Ants | `InstanceManager` | 實際送進去的螞蟻數 |

### 怎麼量得準

1. **切換設定後等 3~5 秒**再讀數，讓指數平滑收斂、也讓 shader 編譯完成。
2. **每個 Case 記 3 組數字取中位數**，避免單次跳動誤導。
3. 讓相機**停在同一個位置**，因為 Distance Culling 的可見數量取決於相機位置。
4. 如果數字持續跳動，記下「區間」而不是單一數字。

### 啟用 Memory 量測（選用）

Chrome 預設不暴露 `performance.memory`，需用旗標啟動：

**macOS / Linux**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --enable-precise-memory-info
```

**Windows**

```
chrome.exe --enable-precise-memory-info
```

> 注意：即使啟用，Chrome 仍會把 heap 用量量化成固定桶，不適合做 Case 間比較。

------------------------------------------------------------------------

## 回填結果

若用 `npm run bench:gpu`，結果已經寫在 `docs/verification/report-gpu.json`，直接 commit 即可。
若手動量測，請開 PR 或在 issue
[#8](https://github.com/chiisen/Minecraft/issues/8) 留言，貼上：

```text
環境
- GPU：
- 瀏覽器 / 版本：
- 解析度：1920×1080（已確認）
- Memory 量測：已加 --enable-precise-memory-info / 未加

結果（每個 Case：ON / OFF，記 3 組取中位數）
| Case | Instancing | Shadows | FPS | Frame Time | Draw Calls | Triangles | Vertices | Visible Objects | Memory |
|---|---|---|---|---|---|---|---|---|---|
| A    | ON  | OFF |      |            |            |           |         |                 |        |
| A    | OFF | OFF |      |            |            |           |         |                 |        |
| B    | ON  | OFF |      |            |            |           |         |                 |        |
| B    | OFF | OFF |      |            |            |           |         |                 |        |
| C    | ON  | OFF |      |            |            |           |         |                 |        |
| C    | OFF | OFF |      |            |            |           |         |                 |        |
| C'   | ON  | ON  |      |            |            |           |         |                 |        |
```

------------------------------------------------------------------------

## 判讀重點

依 PRD §19 Rule 6「只解決實際量測到的瓶頸」判讀：

- **若三個 Case 都 ≥ 60 FPS** → 效能驗收通過，issue #8 可結案。
- **若只有 C（10,000 隻）掉幀** → 瓶頸在高物件數，檢查
  「Draw Calls 還是 Vertices 主導」來決定方向：
  - Draw Calls 高 → 考慮更積極的 Culling / 合併變體。
  - Vertices / Triangles 高 → 考慮 Hidden Face Removal 或更好的 LOD。
- **若只有 C'（Shadows ON）掉幀** → 瓶頸在陰影貼圖成本，可考慮降低 shadow map
  解析度、限制 `castShadow` 的物件（例如只讓建築投影，螞蟻不投）。
- **若 FPS 隨相機移動劇烈波動** → 檢查 Distance Culling 是否真的生效
  （`Rendering → Distance Culling` 應該是 ON）。
- **若 Pass 2（解除 vsync）也只有 60~70 FPS** → 這才是真的接近瓶頸，值得優化。
  若 Pass 2 顯示數百 FPS，則代表負載遠低於臨界點，**不應為了未來而提前複雜化**
  （PRD §19 Rule 6）。

> 提醒：SwiftShader 那份報告（`report.json`）**只可用來比對
> Draw Calls / Triangles / Vertices / Objects 這些「結構數字」**，
> 那些與 GPU 型號無關；FPS 與 Frame Time 一律以 `report-gpu.json` 為準。
