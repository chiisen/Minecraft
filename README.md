# Multi-Scale Voxel Web Demo

以 **Three.js + TypeScript + Vite** 實作的多尺度體素視覺驗證 Prototype。
同一個場景裡放進 House / Tree / Human / Flower / Ant 五種尺度，驗證
「不同尺度可以用同一套 Voxel 視覺語言呈現」這個核心命題。

完整需求與設計請見 [`multi-scale-voxel-web-demo-prd.md`](./multi-scale-voxel-web-demo-prd.md)。

## 目前進度

| 階段 | 內容 | 狀態 |
|---|---|---|
| Phase 1 | 視覺 Prototype（多尺度共存） | ✅ 程式碼 + 自動截圖驗證 |
| Phase 2 | 效能 Prototype（Instancing / LOD / Distance Culling） | ✅ 程式碼（實機 GPU 效能待測） |
| Phase 3 | Character 粗方塊 vs 細方塊對照實驗 | ⬜ 未開始 |
| Phase 4 | 依 Benchmark 結果最佳化 | ⬜ 未開始 |
| Phase 5 | Review | ⬜ 未開始 |

> 開發進度以 GitHub issue 追蹤。Phase 1 的視覺驗證產出在
> [`docs/verification/`](./docs/verification/)。

## 環境需求

- Node.js 18 以上（開發使用 20）
- 支援 WebGL2 的桌面瀏覽器（目標為 Chrome，1920×1080 / 60 FPS）

## 安裝與執行

```bash
npm install
npm run dev        # 開發伺服器，預設 http://localhost:5173
```

其他指令：

```bash
npm run build      # tsc --noEmit && vite build，輸出到 dist/
npm run preview    # 預覽 production build
npm run screenshots # 自動截圖驗證，輸出到 docs/verification/（見下）
npm test           # Vitest 單元測試（sceneStats frustum culling 語意）
```

## 操作說明

| 操作 | 功能 |
|---|---|
| 點擊畫面 | 進入滑鼠視角（Pointer Lock） |
| `Esc` | 離開滑鼠視角 |
| `W` `A` `S` `D` | 前 / 左 / 後 / 右 移動 |
| 滑鼠 | 轉向 |
| `Space` | 上升 |
| `Ctrl` | 下降 |
| `Shift`（按住） | 加速移動（30 → 90 單位 / 秒） |

## Debug UI

畫面右上角的 lil-gui 面板（`src/debug/DebugPanel.ts`）可直接調整場景與渲染方式。

**Scene**

- `Ant Count` / `Flower Count` — 調整螞蟻與花朵數量
- `100 Ants` / `1,000 Ants` / `10,000 Ants` — 快速切換 preset

**Rendering**

- `Instancing` — Instancing ON / OFF 對照。**OFF 有安全上限 1,000 隻**，
  超出時只畫 1,000 隻，避免瀏覽器崩潰（PRD 要求）
- `LOD` — 遠處的螞蟻改用簡化模型
- `Distance Culling` — 超出距離的個體不送出渲染
- `Shadows` — 陰影。10,000 隻時請注意效能
- `Wireframe` — 線框模式，用來觀察三角形結構

**Performance**

- `FPS` / `Frame Time` / `Triangles` / `Draw Calls` / `Objects` / `Visible Ants` 即時讀數

## 自動截圖驗證

```bash
npx playwright install chromium   # 首次需要下載瀏覽器
npm run screenshots
```

`tools/capture-screenshots.mjs` 會啟動 vite dev server，用 headless Chromium
透過除錯 API 固定鏡頭與場景參數，逐一截圖並量測 Instancing ON / OFF 的
draw call 與三角形數，輸出到 `docs/verification/`。

除錯 API（`src/debug/DevApi.ts`）只在 `import.meta.env.DEV` 時掛上 `window.__voxel`，
production build 不含此 API，所以腳本必須使用 dev server。

> ⚠️ headless 環境使用 SwiftShader（CPU 軟體渲染），**FPS 沒有參考價值**；
> 只有 draw call 與三角形數可信。真實效能需在實機 GPU 上量測。

## 專案結構

```text
src/
├─ main.ts                  # 進入點
├─ core/Game.ts             # renderer / scene / camera / 渲染迴圈 / 輸入
├─ world/                   # 場景內容
│  ├─ World.ts              # 物件組裝與數量控制
│  ├─ placement.ts          # 靜態物件位置與擺放「排除區域」
│  └─ Ground.ts             # 地面
├─ objects/                 # 各尺度的 Voxel 模型（純資料）
│  ├─ House.ts  Tree.ts  Character.ts  Flower.ts  Ant.ts
├─ voxel/                   # 純資料層，不依賴 Three.js
│  ├─ Primitive.ts          # Voxel / Primitive 形狀與顏色
│  ├─ MeshBuilder.ts        # Primitive → 單一 BufferGeometry
│  └─ random.ts             # mulberry32，可重現的偽隨機
├─ rendering/InstanceManager.ts  # Instancing / LOD / Distance Culling
└─ debug/                   # lil-gui 面板、效能讀數、除錯 API
tools/capture-screenshots.mjs    # 自動截圖 harness
```

核心架構規則：**1 voxel ≠ 1 Three.js Mesh**。Voxel 資料（`src/objects`、`src/voxel`）
與渲染資料（`src/rendering`）分離，一個物件的所有方塊會合併成單一 Geometry。

## 技術限制（依 PRD）

- 不使用 Vue / React / 任何前端框架
- 不引入 Backend / Database / ECS / Physics Engine
- 不使用原生 WebGPU
- Phase 1 的 Primitive 只有 Cube / Cuboid / Quad
