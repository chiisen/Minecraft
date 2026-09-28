# Multi-Scale Voxel Web Demo --- PRD

## 1. 專案概要

本專案是一個以 **Three.js + TypeScript + Vite** 製作的網頁版 3D 技術
Demo。

核心概念受到 Minecraft
啟發，但不採用「所有物件都由相同大小方塊構成」的限制，而是實驗
**多尺度體素（Multi-Scale Voxel）**：

-   建築與地形使用較粗粒度的基本元件。
-   花草、家具使用中等粒度。
-   人物使用較細粒度，使臉部與身體輪廓比 Minecraft 自然。
-   螞蟻等微型生物使用最小尺度。
-   所有物件仍維持「由簡單基本元件組成」的統一視覺語言。

第一階段的目的不是完成一款 Minecraft Clone，而是驗證：

1.  多尺度 Voxel 放在同一世界是否具有一致且好看的視覺效果。
2.  細緻 Voxel 人物能否改善 Minecraft 方塊人物的外觀問題。
3.  大量微型物件在一般玩家電腦與瀏覽器中是否能維持良好效能。
4.  此概念是否值得進一步發展成真正遊戲。

------------------------------------------------------------------------

## 2. 核心設計理念

> Everything is made from the same building system, but not everything
> uses the same scale.

世界中的物件共享相同的基本建構哲學，但允許不同尺度。

概念：

``` text
World
│
├── Building     → 粗粒度
├── Tree         → 粗 + 中 + 細粒度
├── Furniture    → 中粒度
├── Flower       → 細粒度
├── Character    → 細粒度
└── Ant          → 最小粒度
```

重要原則：

**Voxel 是描述物件的資料，不等於一個獨立的 GPU Object。**

禁止採用：

``` text
1 voxel
=
1 Object
=
1 Mesh
=
1 Draw Call
=
1 Collider
```

------------------------------------------------------------------------

## 3. 技術棧

固定使用：

-   TypeScript
-   Vite
-   Three.js
-   WebGL Renderer
-   stats.js
-   lil-gui

第一階段不使用：

-   Vue
-   React
-   Backend
-   Database
-   ECS Framework
-   Physics Engine
-   原生 WebGPU API

若 Three.js 未來自行使用 WebGPU，可另行評估；第一階段不得自行實作 WebGPU
Renderer。

------------------------------------------------------------------------

## 4. 目標平台

主要目標：

-   Desktop Chrome
-   1920 × 1080
-   60 FPS

Demo 應以一般消費級 PC 為目標，而不是高階遊戲電腦。

參考 GPU 等級：

-   GTX 1660
-   RTX 3050
-   RX 6600

不應以 RTX 4070 / 4080 / 4090 等高階 GPU 作為最低效能假設。

------------------------------------------------------------------------

## 5. 世界尺度系統

定義最小世界單位：

``` text
1 Unit = 最小可表示單位
```

建議 Primitive Scale：

``` text
1 × 1 × 1
2 × 2 × 2
4 × 4 × 4
8 × 8 × 8
```

不同物件可以混用尺度。

例如：

``` text
House
├── Wall      4×4
├── Roof      4×4 / 2×2
└── Detail    2×2

Tree
├── Trunk     4×4
├── Branch    2×2
└── Leaf      1×1

Character
├── Body      2×2
├── Head      2×2 / 1×1
├── Hair      1×1
├── Eye       1×1
└── Detail    1×1

Ant
└── Detail    1×1
```

這些只是設計指引，不應將尺度硬編碼到物件類型。

------------------------------------------------------------------------

## 6. Primitive System

第一版只允許少量 Primitive：

-   Cube
-   Cuboid
-   Quad（必要時）

暫不加入：

-   任意 Polygon Modeling
-   Wedge
-   Sphere
-   高階建模工具

目的在於驗證少量基本元件是否足以產生具有特色的世界與角色。

------------------------------------------------------------------------

## 7. Demo 場景

第一個場景為固定的 Voxel Playground。

至少包含：

``` text
Ground

House × 1

Tree × 3

Flower × 50

Character × 1

Ant × 可調整數量
```

視覺上必須能明顯感受到：

``` text
House > Human > Flower > Ant
```

不同尺度共存。

------------------------------------------------------------------------

## 8. Character Prototype

人物是本 Prototype 的核心。

不得直接使用 Minecraft 式：

``` text
1 Head Cube
1 Body Cube
2 Arm Cubes
2 Leg Cubes
```

應由較多的小型 Primitive 組成，使：

-   頭部具有較自然輪廓。
-   臉不是單一巨大方塊。
-   可以表現眼睛。
-   可以表現鼻子或嘴巴。
-   可以表現頭髮。
-   身體比例較自然。
-   仍然可以看出積木 / Voxel 美術風格。

第一版人物可以是靜態模型。

Skeleton Animation 不屬於第一階段必要功能。

------------------------------------------------------------------------

## 9. Ant Stress Test

螞蟻用來驗證大量微型物件的效能。

Debug UI 必須至少提供：

``` text
100 Ants
1,000 Ants
10,000 Ants
```

可快速切換。

大量相同物件應優先研究：

**Three.js InstancedMesh / GPU Instancing（GPU 實例化）**

禁止建立：

``` text
10,000 ants
×
數十個獨立 Mesh Object
```

應盡可能共用：

-   Geometry
-   Material
-   Texture

------------------------------------------------------------------------

## 10. Rendering Architecture

建議資料流程：

``` text
Object Definition
       ↓
Primitive / Voxel Data
       ↓
Mesh Builder
       ↓
Optimized Geometry
       ↓
Three.js Mesh / InstancedMesh
       ↓
Renderer
```

Voxel / Primitive Data 與 Render Object 必須分離。

不得讓資料模型直接依賴大量 Three.js Object。

------------------------------------------------------------------------

## 11. Mesh Optimization

第一階段應研究：

### 11.1 Hidden Face Removal

相鄰 Cube 的內部面不應送入 GPU。

### 11.2 Geometry Merge

可合併的 Primitive 應盡可能合併為較少 Mesh。

### 11.3 Instancing

大量相同物件，例如：

-   Ant
-   Flower
-   Grass
-   Decoration

優先使用 InstancedMesh。

### 11.4 Frustum Culling

使用 Three.js 現有能力避免渲染攝影機視野外物件。

### 11.5 Distance Culling

非常小的物件在距離過遠時應直接隱藏。

例如 Ant 不需要在遠距離繼續 Render。

------------------------------------------------------------------------

## 12. LOD

LOD（Level of Detail，細節層級）是後續效能驗證的重要項目。

概念：

``` text
LOD0
完整模型

LOD1
簡化模型

LOD2
低細節模型

LOD3
Hidden / Impostor
```

第一版不要求建立完整通用 LOD Framework。

可以先針對 Character / Ant 做最小實驗。

避免過度工程化。

------------------------------------------------------------------------

## 13. Camera / Controls

第一版至少提供：

-   WASD 移動
-   Mouse Look
-   基本第一人稱或自由攝影機

不要求：

-   Jump Physics
-   Character Controller
-   Combat
-   Interaction System

Camera 的目的主要是讓使用者能靠近不同尺度的物件觀察視覺效果。

------------------------------------------------------------------------

## 14. Debug UI

使用 lil-gui。

至少提供：

``` text
Scene
────────────────────
Ant Count
Flower Count

Rendering
────────────────────
Instancing     ON/OFF
LOD            ON/OFF
Shadows        ON/OFF
Wireframe      ON/OFF

Performance
────────────────────
FPS
Frame Time
Triangles
Draw Calls
Objects
```

Performance 資料應使用：

-   stats.js
-   renderer.info

取得。

------------------------------------------------------------------------

## 15. Benchmark

不得只回報 FPS。

至少記錄：

``` text
FPS
Frame Time
Draw Calls
Triangles
Vertices（若可取得）
Visible Objects
Memory（瀏覽器允許時）
```

Benchmark 至少測試：

### Case A

``` text
1 Character
50 Flowers
100 Ants
```

### Case B

``` text
1 Character
50 Flowers
1,000 Ants
```

### Case C

``` text
1 Character
50 Flowers
10,000 Ants
```

比較：

``` text
Instancing OFF
vs
Instancing ON
```

若 OFF 模式因瀏覽器風險過高，可以設定安全上限，不得故意造成頁面崩潰。

------------------------------------------------------------------------

## 16. 第一階段非目標

禁止主動實作：

-   Infinite World
-   Chunk Streaming
-   Procedural Terrain
-   Inventory
-   Crafting
-   Combat
-   Health
-   Hunger
-   NPC Dialogue
-   Quest
-   Multiplayer
-   Server
-   Database
-   Account System
-   Save / Load
-   Complex Physics
-   Complex AI
-   Weather
-   Day / Night
-   Mod System
-   Character Customization
-   Full Animation System

除非某項功能是驗證核心假設不可避免的最低需求。

------------------------------------------------------------------------

## 17. 專案結構

建議初始結構：

``` text
src/
├── main.ts
│
├── core/
│   └── Game.ts
│
├── world/
│   ├── World.ts
│   └── Ground.ts
│
├── voxel/
│   ├── VoxelModel.ts
│   ├── Primitive.ts
│   └── MeshBuilder.ts
│
├── objects/
│   ├── House.ts
│   ├── Tree.ts
│   ├── Flower.ts
│   ├── Character.ts
│   └── Ant.ts
│
├── rendering/
│   └── InstanceManager.ts
│
└── debug/
    ├── DebugPanel.ts
    └── PerformanceMonitor.ts
```

此結構只是初始建議。

AI Agent 不得為了符合目錄結構而建立沒有實際用途的 Class。

遵守 KISS。

------------------------------------------------------------------------

## 18. Coding Rules

使用：

-   TypeScript strict mode
-   ES Modules
-   明確型別
-   小型、單一責任函式
-   優先 Composition 而非複雜 inheritance hierarchy

避免：

-   `any`
-   Global mutable state
-   過度抽象
-   過早建立 ECS
-   過早建立 Plugin System
-   過早建立 Event Bus
-   過早建立 Dependency Injection Framework
-   未使用的 Interface / Abstract Class

任何 abstraction 都必須解決目前已存在的問題。

------------------------------------------------------------------------

## 19. Performance Rules

必須遵守：

### Rule 1

``` text
1 voxel != 1 Three.js Mesh
```

### Rule 2

大量相同物件優先使用 Instancing。

### Rule 3

Rendering Data 與 Gameplay / Voxel Data 分離。

### Rule 4

看不到的 Geometry 不應 Render。

### Rule 5

距離遠到無法辨識的微型物件應 Cull。

### Rule 6

不要為了「未來可能需要」而犧牲目前 Prototype 的簡潔度。

------------------------------------------------------------------------

## 20. 開發階段

### Phase 0 --- Requirement Review

不要 Coding。

Agent 必須：

1.  重新描述需求。
2.  找出需求中的矛盾或模糊處。
3.  列出最高風險的技術問題。
4.  提出最小實作方案。

完成後等待 Review。

------------------------------------------------------------------------

### Phase 1 --- Visual Prototype

實作：

-   Ground
-   House
-   Tree
-   Flower
-   Character
-   Ant
-   Camera
-   Lighting

目的：

> 驗證不同 Voxel Scale 放在同一世界是否好看。

不進行複雜效能最佳化。

------------------------------------------------------------------------

### Phase 2 --- Performance Prototype

加入：

-   stats.js
-   renderer.info
-   lil-gui
-   Ant Count Control
-   Instancing
-   Distance Culling

目的：

> 驗證大量微型物件的瀏覽器效能。

------------------------------------------------------------------------

### Phase 3 --- Character Experiment

改善 Character：

-   Head Shape
-   Face
-   Hair
-   Body Proportion

比較：

``` text
Minecraft-like coarse character

vs

Multi-Scale fine voxel character
```

目的：

> 驗證細尺度 Voxel 是否真的能解決方塊人物不好看的問題。

------------------------------------------------------------------------

### Phase 4 --- Optimization

視 Benchmark 結果決定是否需要：

-   Geometry Merge
-   Hidden Face Removal
-   LOD
-   更積極的 Culling

只解決實際量測到的瓶頸。

------------------------------------------------------------------------

### Phase 5 --- Review

回答：

1.  Multi-Scale Voxel 視覺是否成立？
2.  Character 是否明顯比傳統方塊人物自然？
3.  10,000 個微型生物是否可接受？
4.  GPU 是否為主要瓶頸？
5.  CPU 是否為主要瓶頸？
6.  Draw Call 是否為主要瓶頸？
7.  是否值得進入真正遊戲 Prototype？

------------------------------------------------------------------------

## 21. Success Criteria

Prototype 成功需要：

### Visual

不同尺度物件共存時不產生明顯違和。

### Character

人物具有 Voxel / 積木特色，但不呈現 Minecraft 式巨大方塊臉。

### Performance

一般消費級桌面電腦：

``` text
1920×1080
Target: 60 FPS
```

大量小型物件開啟最佳化後仍具有合理效能。

### Architecture

不存在：

``` text
1 voxel = 1 Mesh
```

等明顯不可擴展設計。

### Development

程式碼保持足夠簡單，可以快速修改核心概念。

------------------------------------------------------------------------

# AI Agent Instructions

閱讀完整 PRD 後：

**不要立即 Coding。**

第一個回覆只需要輸出以下內容：

## A. Requirement Understanding

用自己的話重新描述你理解的 Prototype。

## B. Assumptions

列出你為了實作所做的假設。

## C. Top Technical Risks

列出最高風險的 5 個問題。

每個問題包含：

-   Risk
-   Impact
-   最小驗證方法

## D. Minimal Architecture

提出可以完成 Phase 1 的最小架構。

不要設計完整遊戲架構。

## E. Phase 1 Implementation Plan

列出預計：

-   新增哪些檔案
-   每個檔案的責任
-   實作順序
-   完成條件

## F. Challenge the PRD

如果 PRD 中存在：

-   不合理需求
-   過早最佳化
-   技術矛盾
-   不必要 abstraction

直接指出。

不要為了迎合需求而隱藏問題。

完成以上內容後：

**STOP。**

等待人工 Review 後才開始 Coding。
