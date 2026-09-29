# 實機 GPU 效能量測步驟（issue #8 / PRD §21）

本專案的自動驗證（`npm run screenshots`）跑在 **headless Chromium + SwiftShader**，
那是 CPU 軟體渲染，**FPS / Frame Time 完全沒有參考價值**——它量到的是你的 CPU，
不是顯示卡。因此 PRD §21 的「1920×1080 / 一般消費級 PC / 60 FPS」驗收項，
以及 issue #8 的「Shadows ON + 10,000 隻 InstancedMesh 效能」，
都必須在**真實 GPU** 上量一次。

本文件說明怎麼量、要記什麼、數字要怎麼回填。

------------------------------------------------------------------------

## 1. 環境要求

| 項目 | 建議 |
|---|---|
| 作業系統 | Windows 10/11、macOS 13+、或主流 Linux 桌機 |
| GPU | 一般消費級獨立或內顯皆可（目標是「一般消費級電腦」） |
| 瀏覽器 | **Chrome / Edge 最新版**（`performance.memory` 只有 Chromium 系有） |
| 解析度 | 視窗或無痕視窗全螢幕，確認為 **1920×1080** |
| 其他 | 量測時關閉其他吃 GPU 的程式（遊戲、影片播放、視訊會議） |

> 請一併記下 **GPU 型號**與**瀏覽器版本**，否則數字無法重現。

------------------------------------------------------------------------

## 2. 取得程式碼

```bash
git clone git@github.com:chiisen/Minecraft.git
cd Minecraft
npm install
```

------------------------------------------------------------------------

## 3. 啟動 demo

```bash
npm run dev
```

開啟瀏覽器進入它印出來的網址（預設 `http://localhost:5173`）。

**為什麼用 `npm run dev` 而不是 `npm run preview`？**
除錯 API（`window.__voxel`）只在 dev 模式註冊。不過本文件的手動流程**不需要**除錯 API，
Debug UI 在兩種模式下都在，所以 `npm run preview` 也可以量。
若你想完全比照自動驗證的設定（固定鏡頭、固定 Case），才需要用 `npm run dev` + 指令。

------------------------------------------------------------------------

## 4. 設定量測情境

在畫面左上角會看到 **stats.js 面板**（FPS / MS / MB）與右上角的 **lil-gui Debug UI**。

PRD §15 定義三個 Case，每個 Case 都要量 **Instancing ON 與 OFF**：

| Case | Ant Count | Flower Count | 其他 |
|---|---:|---:|---|
| A | 100 | 50 | 預設 |
| B | 1,000 | 50 | 預設 |
| C | 10,000 | 50 | 預設 |
| C' | 10,000 | 50 | **額外**：Shadows = ON（issue #8 的重點） |

操作步驟（每個 Case 重複一次 ON / OFF）：

1. `Scene → Ant Count` 設成 100 / 1,000 / 10,000
   （或直接點 Scene 資料夾裡的 `100 Ants` / `1,000 Ants` / `10,000 Ants` 三個預設鈕）
2. `Scene → Flower Count` 設 **50**
3. `Rendering → Instancing` 切成 **ON**，記下數字
4. `Rendering → Instancing` 切成 **OFF**，記下數字
5. （只在 Case C 做）`Rendering → Shadows` 切成 **ON**，再記一次

> **Instancing OFF 的安全上限**：關掉 Instancing 後程式會把螞蟻數**自動限制在 1,000 隻**
> （`MAX_NON_INSTANCED_ANTS`），這是 PRD §15「不得故意造成頁面崩潰」的要求。
> 所以 10,000 隻在 OFF 模式下實際只會畫 1,000 隻，這是**預期行為**，不是 bug。

------------------------------------------------------------------------

## 5. 要記錄的數值

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

另外建議記錄 **Memory**：Chrome 需開啟旗標才能讀到 `performance.memory`。

### 怎麼量得準

1. **切換設定後等 3~5 秒**再讀數，讓指數平滑收斂、也讓 shader 編譯完成。
2. **每個 Case 記 3 組數字取中位數**，避免單次跳動誤導。
3. 讓相機**停在同一個位置**（建議用 Debug UI 之外手動走遠一點、拉遠一點），
   因為 Distance Culling 的可見數量取決於相機位置。
4. 如果數字持續跳動，記下「區間」而不是單一數字。

------------------------------------------------------------------------

## 6. 啟用 Memory 量測（選用）

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

啟動後用這個視窗開 demo，Memory 欄位就會顯示真實值（而非瀏覽器量化過的粗略值）。

------------------------------------------------------------------------

## 7. 可選：用自動化腳本跑（固定鏡頭、與報告完全可比）

若你想讓實機數字與 `docs/verification/report.json` **完全可比**（同鏡頭、同設定），
可以讓腳本用真實 GPU 跑，而不是 headless + SwiftShader：

1. 確認已 `npm install`
2. 執行以下指令（差異只在瀏覽器啟動參數）：

```bash
npx playwright install chromium   # 首次
node tools/capture-screenshots.mjs
```

3. 開啟 `tools/capture-screenshots.mjs`，找到 `chromium.launch({ args: [...] })`，
   **刪掉**這三個 SwiftShader 參數：

   ```js
   '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'
   ```

4. 執行 `node tools/capture-screenshots.mjs`

這樣會用你電腦的真實 GPU 渲染，並在 `docs/verification/report.json` 留下
**含 Vertices 的完整數據**（FPS / Frame Time / Draw Calls / Triangles / Vertices /
Visible Objects / Memory）。

> 注意：這個模式**不要 commit**，跑完請 `git checkout -- docs/verification/`
> 還原，或把結果貼到 issue #8。

------------------------------------------------------------------------

## 8. 回填結果

量完後，請開一個 PR 或直接在 issue
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

## 9. 判讀重點

拿到數字後，依 PRD §19 Rule 6「只解決實際量測到的瓶頸」判讀：

- **若三個 Case 都 ≥ 60 FPS** → 效能驗收通過，issue #8 可結案。
- **若只有 C（10,000 隻）掉幀** → 瓶頸在高物件數，檢查
  「Draw Calls 還是 Vertices 主導」來決定方向：
  - Draw Calls 高 → 考慮更積極的 Culling / 合併變體。
  - Vertices / Triangles 高 → 考慮 Hidden Face Removal 或更好的 LOD。
- **若只有 C'（Shadows ON）掉幀** → 瓶頸在陰影貼圖成本，可考慮降低 shadow map
  解析度、限制 `castShadow` 的物件（例如只讓建築投影，螞蟻不投）。
- **若 FPS 隨相機移動劇烈波動** → 檢查 Distance Culling 是否真的生效
  （`Rendering → Distance Culling` 應該是 ON）。

> 提醒：SwiftShader 那份報告（`docs/verification/report.json` 內）**只可用來比對
> Draw Calls / Triangles / Vertices / Objects 這些「結構數字」**，
> 那些與 GPU 型號無關；FPS 與 Frame Time 一律以實機數字為準。
