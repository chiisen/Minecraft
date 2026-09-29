# 驗證報告（Phase 1 視覺 / Phase 2 效能 / Phase 3 對照）

本目錄的截圖與 `report.json` 全部由 `tools/capture-screenshots.mjs` 自動產生，可重現。

> ⚠️ **這份報告的 FPS / Frame Time 沒有參考價值**——自動驗證跑在 headless Chromium +
> SwiftShader（CPU 軟體渲染）。PRD §21 的 60 FPS 驗收必須在真實 GPU 上做，
> 步驟見 **[`ON-DEVICE-MEASUREMENT.md`](ON-DEVICE-MEASUREMENT.md)**（issue #8）。
> 與 GPU 無關的結構數字（draw call / triangles / vertices / objects / geometries）可直接引用。

對應 GitHub issues：

- [#3](https://github.com/chiisen/Minecraft/issues/3) Phase 1 視覺驗證（截圖）
- [#4](https://github.com/chiisen/Minecraft/issues/4) Phase 2 效能 Benchmark（Case A/B/C）
- [#5](https://github.com/chiisen/Minecraft/issues/5) Phase 3 Character 粗 / 細對照實驗
- [#6](https://github.com/chiisen/Minecraft/issues/6) Phase 4 依 Benchmark 決定最佳化項目
- [#7](https://github.com/chiisen/Minecraft/issues/7) 尺度決策（House > Human）
- [#8](https://github.com/chiisen/Minecraft/issues/8) 實機 GPU 效能（Shadows ON）
- [#9](https://github.com/chiisen/Minecraft/issues/9) Phase 5 Review（回答 PRD 7 個問題）

## 怎麼跑

```bash
npm install
npx playwright install chromium   # 首次需要下載瀏覽器
npm run screenshots
```

> `playwright` 已列在 devDependencies。

腳本做的事：

1. 啟動 vite dev server（port 5197）——只有 dev 模式會註冊 `window.__voxel` 除錯 API。
2. 用 headless Chromium + SwiftShader 開頁面。
3. 透過除錯 API 精準設定鏡頭與場景參數，逐一截圖到本目錄。
4. 量測 Phase 2 Benchmark：Case A/B/C × Instancing ON/OFF 的 draw call、三角形、
   頂點數、可見物件數、記憶體（PRD §15 要求的欄位）。
5. 檢查每張圖是否為空白帧，並輸出 `report.json`。

> **想在真實 GPU 上跑同一份量測？** 見
> [`ON-DEVICE-MEASUREMENT.md`](ON-DEVICE-MEASUREMENT.md) 第 7 節。

## 為什麼用 headless

截圖需要固定視角與參數，人工操作無法重現。除錯 API（`src/debug/DevApi.ts`）只在
`import.meta.env.DEV` 時掛上 `window.__voxel`，production build 不含此 API。

## ⚠️ FPS 沒有參考價值

SwiftShader 是 CPU 軟體渲染，FPS 與真實 GPU 無關。**只有 drawCall 與 triangle 數可信**
（與 GPU 後端無關）。真實效能驗證必須在實機 GPU 上做，見 issue
[#4](https://github.com/chiisen/Minecraft/issues/4) 與 [#8](https://github.com/chiisen/Minecraft/issues/8)。

## 截圖清單

| 檔案 | 內容 | 鏡頭 |
|---|---|---|
| `01-overview.png` | 全場景同框 | 俯瞰 |
| `02-scale-lineup.png` | 尺度對照（隱藏螞蟻與花） | House 與 Character 的**等距點** |
| `03-house-facade.png` | House 正面 | 正面（避開 Tree#2 樹冠） |
| `04-character-full.png` | Character 全身 | 正面平視 |
| `05-character-face.png` | Character 頭部特寫 | 特寫 |
| `06-tree.png` | Tree 混合尺度 | 側面 |
| `07-flowers-ground.png` | 花卉群 200 朵 | 花圈外 |
| `08-ant-field.png` | 螞蟻 10,000 隻 | 俯瞰（關閉距離剔除） |
| `09-ant-closeup.png` | 螞蟻 1,000 隻 | 對準 #7 的 3/4 前側視角 |
| `10-character-compare.png` | 粗 / 細 Character 並排（Phase 3 A/B） | 水平平視（`coarseCharacter: true`） |

鏡頭位置是刻意挑的，而且踩過幾個坑：

- 花的分佈是**半徑 8~50 的圓環**。相機若落在圓環內會直接貼在花上，所以 `07` 的相機
  取在圓環外，`09` 直接把 `flowerCount` 設 0。
- `02-scale-lineup` 的相機取在 House 與 Character 的**等距點**上，否則透視會讓其中一方
  被放大而誤導尺度判讀。
- `03-house-facade` 相機必須避開 Tree#2 的樹冠（z 25.7~40.1）。第一版相機落在樹冠內部，
  整張圖變暗（mean 44,95,51）。
- `08-ant-field` 必須 **關閉 distanceCulling**，否則拍到的是距離剔除後的假分佈
  （看起來像一小塊菱形，而不是完整圓盤）。
- `09-ant-closeup` 的相機要落在螞蟻的**前側方**。螞蟻 #7 朝向約 75.7°，若從正後方拍，
  頭部與觸角會被身體擋住，誤判為「沒有觸角」。
- `10-character-compare` 的相機採**水平平視**（y = 10.5），且 `coarseCharacter` 開關只在
  這個 shot 開啟。開關必須在每個 shot 前還原（`DEFAULT_FLAGS`），否則粗角色會殘留到後續
  的效能量測。

## Phase 2 效能 Benchmark（`report.json`）

場景固定為 1 Character + 50 Flowers + {100, 1000, 10000} Ants，每個 Case 比較
Instancing ON / OFF。欄位定義：

- **drawCalls / triangles**：來自 `renderer.info.render`，是**整帧總量**，含場景其他物件。
  第一列 `antCount = 0` 是基準線，用來扣掉場景本身（ground / house / tree / flower / character）。
- **vertices**：本幀實際送入 GPU 的頂點數（PRD §15 要求）。`renderer.info` 不提供此欄位，
  由 `countVertices` 從各 Mesh 的 position attribute 加總，`InstancedMesh` 乘上實例數，
  並**先做 frustum culling 判定**以與 triangles 保持同一語意。
- **visible**：實際送入 GPU 的螞蟻數（已扣距離剔除與安全上限）。
- **objects**：場景中 `THREE.Mesh` 的總數（`countMeshes`）。
- **geometries / textures**：`renderer.info.memory`。
- **heapMB**：`performance.memory.usedJSHeapSize`（Chrome 專屬）。**此值被 Chrome 量化成
  固定桶**（本輪全部回報 10,000,000 B），解析度不足，**不可用來做 Case 間比較**。

| case | 螞蟻數 | Instancing | Draw calls | Triangles | Vertices | visible | objects | geometries | heapMB |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | 0 | ON | 20 | 10,958 | 21,916 | 0 | 23 | 23 | 9.5 |
| A ON | 100 | ON | 22 | 14,306 | 28,612 | 65 | 23 | 23 | 9.5 |
| A OFF | 100 | OFF | 37 | 14,018 | 28,036 | 65 | 1,023 | 23 | 9.5 |
| B ON | 1,000 | ON | 22 | 47,822 | 95,644 | 740 | 1,023 | 23 | 9.5 |
| B OFF | 1,000 | OFF | 213 | 45,698 | 91,396 | 740 | 1,023 | 23 | 9.5 |
| C ON | 10,000 | ON | **22** | 386,798 | 773,596 | 7,392 | 1,023 | 23 | 9.5 |
| C OFF | 10,000 | OFF | 213 | 45,698 | 91,396 | 740 | 1,023 | 23 | 9.5 |

> **Vertices 的自洽檢查**：所有列的 Vertices : Triangles 皆為 **2 : 1**，與 box 幾何
> （每面 4 頂點 × 6 面 = 24 頂點、12 三角形）完全吻合，代表 frustum 判定與實例數
> 都算對了。這個 2:1 比例若不成立，就代表有物件被重複或漏計。

> **量測修正紀錄**：初版的 `countVertices` 只檢查 `object.visible` 旗標，沒有做
> frustum 判定，導致 `A OFF` 報 45,316 vertices（遠高於實際送 GPU 的 14,018 三角形）。
> 修正為 frustum-aware 後，數字與 triangles 對得上。

### 結論

1. **Instancing 讓 draw call 與螞蟻數量脫鉤**：10,000 隻仍然是 **22** 個 draw call
   （場景 + 花 + 2 個螞蟻 InstancedMesh）。OFF 模式在 1,000 隻就要 **213** 個 draw call。
   這是 Rule 1（`1 voxel != 1 Three.js Mesh`）在螞蟻上的直接體現。
2. **OFF 模式的 C 列與 B 列完全相同**：因為安全上限 `MAX_NON_INSTANCED_ANTS = 1000`
   生效——刻意不讓頁面崩潰（PRD 要求）。`objects` 在 OFF 模式固定為 1,023，與螞蟻數無關。
3. **ON 模式的三角形數較高是預期行為**：ON 會依 LOD 距離混合 detailed / simplified
   模型；OFF 模式一律使用 detailed 幾何，且被 1,000 上限截斷，所以三角形數反而不隨
   螞蟻數成長。
4. **C ON 的 7,392 隻可見**是 Distance Culling（`CULL_DISTANCE = 130`）的結果，
   而非螞蟻沒生成：10,000 隻全在場景中，只是畫面外的沒送 GPU。
5. **CPU 軟體渲染下 FPS 無參考價值**：純粹是 SwiftShader 的 CPU 光柵化成本，
   不能推論實機 GPU 表現。實機驗證見 [`ON-DEVICE-MEASUREMENT.md`](ON-DEVICE-MEASUREMENT.md)
   與 issue #4 / #8。

`console errors: 0`。

## Phase 4 最佳化：花卉改用 InstancedMesh（issue #6）

PRD §20 要求 Phase 4 **只解決實際量測到的瓶頸**（§19 Rule 6：不為未來犧牲目前簡潔度）。

### 量測到的瓶頸

把 `flowerCount` 逐一調整並量測 draw call（螞蟻 0、相機固定在 `[0,20,40]`）：

| 花朵數 | 最佳化前 draw calls | 最佳化後 |
|---:|---:|---:|
| 0 | 6 | 6 |
| 50 | 47 | **19** |
| 100 | 86 | **21** |
| 200 | 168 | **21** |

最佳化前，**draw call 與花朵數 1:1 成長**（每朵花一個獨立 Mesh），是場景中最大的
draw call 來源（200 朵時 168 個 draw call，佔絕大多數）。相比之下，螞蟻在 10,000 隻時
也只有 2 個 draw call。

### 做法（PRD §11.3）

新增 `src/rendering/FlowerField.ts`：依「花莖高度 × 花瓣顏色」把花分成**變體**，
每個變體一個 `InstancedMesh`。花朵外觀（位置、旋轉、顏色）與最佳化前**完全相同**
（使用相同種子與 rng 順序）。變體數上限 3 × 5 = 15，因此 draw call 與花朵數脫鉤。

### 結果

> 以下數字為 Phase 4 **當下**的量測值；Phase 4 之後另有規模調整（House 放大、
> 場景基準線微調），現況數字見上方 Phase 2 表格。

- **draw call 不再隨花朵數成長**：200 朵花由 168 → **21**（8×）。
- 場景基準線（50 朵花）由 47 → **19** draw call。
- `objects` 由 59 → **23**、`geometries` 由 50 → **22**（不再每朵花一個 Mesh / Geometry）。
- 200 朵花的三角形數由 20,366 → 23,558（+16%）。這是因為 InstancedMesh 以整體
  bounding sphere 做視錐剔除，無法逐朵剔除；但 +3K 三角形可忽略，換得 8× 的 draw call 下降。

### 刻意**不做**的最佳化

- **Hidden Face Removal（§11.1）**：三角形數在 10,000 隻螞蟻時也只有 38.6 萬，
  並非量測到的瓶頸，依 Rule 6 暫不實作。
- **花 / 螞蟻的逐朵距離剔除**：InstancedMesh 不支援逐實例剔除；花朵上限 200、
  成本極低，故改為只對螞蟻套用距離剔除。

## Phase 3 Character 粗 / 細對照（`10-character-compare.png`）

對應 issue [#5](https://github.com/chiisen/Minecraft/issues/5)。目標是回答 PRD 的問題：
**「刻意用粗方塊（Minecraft 風格）的角色，是否比多尺度細方塊角色更符合本專案的視覺語言？」**

### 實驗設計

- 新增 `createCoarseCharacterModel()`（`src/objects/Character.ts`）：**6 個大立方體**
  （頭 / 軀幹 / 雙臂 / 雙腿），沿用 Minecraft 8:12:12 比例，再縮放至**與細尺度角色
  相同身高 21**，讓兩者唯一的差異是「顆粒度」，而不是大小。
- 粗角色放在 `COARSE_CHARACTER_POSITION = (1, 6)`，與細角色 `(10, 6)` 並排。
- 預設**隱藏**，由 Debug UI 的 `Coarse Character (A/B)` 開關切換；位置照樣列入
  `GROUND_ZONES`，確保花 / 螞蟻分佈不因開關變動。

### 接地正確性（以程式碼實測，不靠目測）

用 esbuild bundle 後直接算 bounding box：

| 模型 | primitives | minY | maxY | 寬度 |
|---|---:|---:|---:|---:|
| 細尺度 Character | 27 | 0.000 | 21.500 | 8.00 |
| 粗方塊 Character | 6 | 0.000 | 21.000 | 10.50 |

兩者都**完整站在 y = 0 地面**，無懸空或穿模。先前兩輪目測判讀互相矛盾（一次說左穿地、
一次說右懸空），確認是**無接觸陰影下接地邊界誤判的雜訊**；改以程式碼實測為準。

### 結論

視覺判讀確認 `10-character-compare.png` 左（粗，無五官）右（細，有眼睛 / 鼻 / 嘴 / 頭髮）
並排成立，**細尺度角色較自然、較符合本專案「多尺度」的核心賣點**。粗方塊角色雖然
更接近 Minecraft 的辨識感，但它抹平了本專案刻意展示的尺度層次，因此**不採用為主角**；
保留為 Debug UI 的對照選項即可。細節與決策記錄見 issue #5。

## Phase 1 驗證結論（對照 issue #3 的檢查項）

| 檢查項 | 結果 |
|---|---|
| 四個尺度（House > Human > Flower > Ant）共存不違和 | ✅ 通過（House 已放大，見「尺度修正」） |
| Character 有 Voxel 特色、不是 Minecraft 式巨大方塊臉 | ✅ 通過 |
| 近看可辨識眼睛 / 眉毛 / 鼻子 / 嘴巴 / 耳朵 / 髮型 | ✅ 通過（耳朵已修正，見下） |
| 遠看維持整體統一視覺語言 | ✅ 通過 |

### 首輪發現的問題與處理

1. **尺度順序錯誤（違反 PRD §7）** — ✅ 已修正（[#7](https://github.com/chiisen/Minecraft/issues/7)）
   首輪實測 House 高 21、Character 高 21.5 → **Human ≥ House**；門高只有 8，角色卻是
   21.5。已將 House 放大為總高 31、門洞 14（詳見下方「尺度修正」）。

2. **物件擺放互相穿模** — ✅ 已修正（[#12](https://github.com/chiisen/Minecraft/issues/12)）
   花與螞蟻原本隨機撒在整個圓環／圓盤上，會穿過建築。改為在取樣時避開「排除區域」
   （House / Character / Tree 的佔地），實測：

   | 對象 | 修正前落在建築內 | 修正後 |
   |---|---:|---:|
   | 50 朵花 | 13 | 0 |
   | 10,000 隻螞蟻 | 423 | 0 |

   > **更正前一版報告的錯誤主張**：前一版寫「Character 站在 (10,6)，落在 House 屋頂佔地
   > 範圍內，頭部插進屋簷」。經實測，Character (10,6) 與 House (-22,-12) 的佔地
   > （x[-35,-9] z[-22,0] vs x[6,14] z[3,9]）**根本沒有重疊**，是誤把 House 的區域座標
   > 當成世界座標判讀。Tree 與 House 的幾何重疊體積實測為 0（僅 0.1 間隙，視覺上像前後
   > 遮擋）；`TREE_RADIUS` 仍由 34 加大到 38，以消除視覺疑慮並留出明確淨空
   > （House 放大後再調整為 41，見「尺度修正」）。

3. **Tree 樹冠不成形** — ✅ 已修正（[#13](https://github.com/chiisen/Minecraft/issues/13)）
   原本在 46 次取樣、半徑 8 的球內只放進 22~33 顆方塊（覆蓋率僅 3.5%~5.2%），視覺上
   是一堆**懸空、彼此不相連的綠色方塊**。改為**體素格點填滿球體**（`LEAF_STEP = 2`）
   並以隨機半徑製造不規則輪廓，不做隨機挖空。實測葉片數 162 / 175 / 166，葉片與枝幹
   相接、無懸浮。

4. **螞蟻近距離無法辨識** — ✅ 已修正（[#14](https://github.com/chiisen/Minecraft/issues/14)）
   原本 10,000 隻撒在半徑 100 的圓盤上、平均間距約 1.77 單位，但體長 3.6 單位 → 大量
   互相穿透；體色 `0x2b1d16` 過暗，近看是一團深色方塊。修正：
   - 體色改為暖棕 `0x8f5a2e` / 深棕 `0x50331b`，做出明暗對比。
   - 活動半徑 100 → **140**，降低擁擠度。
   - 三節身體加粗並做出**腰身**（中段變細抬高），近看可分辨頭 / 胸 / 腹。
   - 眼睛移到頭部側面並突出；觸角改為**細長、末端上折的倒 L 型**。
   - 近距離截圖改為 3/4 前側視角後，視覺判讀確認「清楚是一隻螞蟻」。

5. **Character 耳朵被頭髮完全遮住** — ✅ 已修正（[#5](https://github.com/chiisen/Minecraft/issues/5)）
   耳朵原本在 x = ±2.6、寬 0.5（外緣 2.85），被 x = ±2.7、寬 0.6 的兩側頭髮（外緣 3.0）
   完全蓋住。修正：
   - 耳朵外移到 x = ±2.85、寬 0.7（外緣 **3.2**，超出頭髮）。
   - 兩側頭髮由整片（深 5.4）改為往後收（深 2.6，中心 z = −1.4），露出臉頰側。
   - 視覺複驗確認耳朵可見（正面 3/4 視角下，角色左耳明確突出於頭髮之外）。

## Phase 5 Review：回答 PRD 的 7 個問題（issue #9）

對應 PRD §20 Phase 5。本節為整個 demo 的總結性 review，
每一題都附上量測或截圖作為證據。

---

### 1. Multi-Scale Voxel 視覺是否成立？

**部分成立**，但有一個 PRD §7 強制要求目前未通過。

成立的部分（10 張截圖皆通過視覺複驗）：

- 四種尺度（House / Character / Flower / Ant）的**模型可讀性**都成立——螞蟻近看可辨識
  為螞蟻（#14）、花卉完整且貼地、花瓣十字完整（Phase 4）、房屋細節清楚。
- 各物件的**渲染語言一致**（同一材質、vertex color），整體視覺不衝突。

**原本未通過的部分（現已修正）**：PRD §7 要求視覺順序 `House > Human > Flower > Ant`。
首輪實測 Character 高 21.5、House 高 21（門高僅 8），Human **≥** House。issue #7 決定
**只放大 House、不動 Character**，修正後 House 高 31（見下方「尺度修正」），順序已成立。

### 2. Character 是否明顯比傳統方塊人物自然？

**是。** Phase 3 A/B 對照（`10-character-compare.png`）並排判讀：

- 粗方塊（6 個大立方體，無五官）→ 一塊顏色，沒有「角色」的感覺。
- 細尺度（27 primitives，27 個方塊組成）→ 有黑髮、眼睛、眉毛、鼻子、嘴巴、耳朵、鞋子。
  視覺判讀明確說「右邊明顯更自然」。

細尺度角色**保留為主角**；粗方塊角色保留為 Debug UI 對照選項，**不採用為主角**。
細節與決策見 issue #5。

### 3. 10,000 個微型生物是否可接受？

**架構上可接受，效能驗證需在實機 GPU 補做。**

| case | 螞蟻 | Draw calls | Triangles | Vertices | visible | objects |
|---|---:|---:|---:|---:|---:|---:|
| C ON | 10,000 | **22** | 386,798 | 773,596 | 7,392 | 1,023 |

- 與 Ant 數量無關的固定成本：22 draw call（場景 + 花 15 個變體 + 螞蟻 2 InstancedMesh）。
- LOD + distance culling 已工作：`visible` = 7,392（扣掉距離剔除與安全上限）。
- `objects` 在 OFF 模式被 1,000 上限截斷（PRD 強制安全上限，刻意不讓瀏覽器崩潰）。
- `geometries` 在所有 Case 都是 23（**不會隨螞蟻數爆增**），這是 Rule 1
  （`1 voxel != 1 Mesh`）的核心驗證。

實機 FPS / Frame Time 待 issue #4 / #8，量測步驟見
[`ON-DEVICE-MEASUREMENT.md`](ON-DEVICE-MEASUREMENT.md)。

### 4. GPU 是否為主要瓶頸？

**無法在本環境回答。** SwiftShader 是 CPU 軟體渲染，無法區分 GPU vs CPU 瓶頸。
`renderer.info` 提供的 draw call / triangle / geometry 數與 GPU 後端無關，可以單獨評估。

需要你在實機 GPU 上跑一次 Phase 2 表格，才能回答。

### 5. CPU 是否為主要瓶頸？

**SwiftShader 下是，但這是工具限制不是真的 CPU 瓶頸。** SwiftShader 把 fillrate 全
丟回 CPU，所以 FPS 數字反映的是 CPU 光柵化成本。C ON 在 SwiftShader 下掉到 14.6 FPS，
純粹是 38.6 萬三角形 × 7,392 instance 的 CPU 模擬繪製負擔，**不可推論實機 GPU 表現**。

實機 CPU vs GPU 切分需 issue #4 / #8 補測，步驟見
[`ON-DEVICE-MEASUREMENT.md`](ON-DEVICE-MEASUREMENT.md)。

### 6. Draw Call 是否為主要瓶頸？

**Phase 4 之前是花卉、之後已不是（以本環境能驗證的範圍為準）。**

量測事實：

| 對象 | 數量 | Phase 4 前 draw call | Phase 4 後 |
|---|---:|---:|---:|
| Flower | 50 | 47 | **19** |
| Flower | 200 | 168 | **21** |
| Ant（Instancing ON） | 10,000 | 49 | **21** |
| Ant（Instancing OFF） | 1,000 | 244 | 216 |

- **花卉**改用 InstancedMesh（按「花莖高度 × 花瓣顏色」分變體）後，draw call 與
  花朵數脫鉤；200 朵時由 168 → 21（8×）。
- **螞蟻**Instancing 早已就緒：10,000 隻只有 2 個 draw call。
- OFF 模式 1,000 隻就要 216 draw call，且 C OFF 被 `MAX_NON_INSTANCED_ANTS = 1000`
  截斷——這是 PRD 強制安全上限，刻意不讓瀏覽器崩潰。

依 Rule 6，Hidden Face Removal、跨模型 Geometry Merge、LOD 擴充至 Character/House
**暫不實作**（非量測到的瓶頸）。

### 7. 是否值得進入真正遊戲 Prototype？

**值得，但有兩個前置需先處理。**

值得的理由（架構已被驗證）：

- **Rule 1（`1 voxel != 1 Mesh`）成立**：每個 `VoxelModel` 只產生 1 個
  `BufferGeometry`；所有 model 共用同一份材質（vertex color）。`geometries` 數
  在 10,000 隻螞蟻時仍維持 23，沒有隨個體數爆增。
- **大量物件路徑已被驗證**：Ant Instancing / LOD / Distance Culling + Flower InstancedMesh，
  10,000 隻螞蟻只有 22 draw call。
- **跨物件靜態擺放**用排除區域（exclusion zone）解掉（#12），不需 Physics Engine，
  符合 PRD 限制。

前置：

1. ~~**尺度決策（issue #7）**：目前唯一未通過的驗收項（Human ≥ House），進遊戲前需定。~~
   → **已解決**：House 放大為總高 31，`House > Human` 成立（見「尺度修正」）。
2. **實機 GPU 效能（issue #8）**：本 demo 在 SwiftShader 下無法評估真實效能，
   陰影 + 10,000 隻 InstancedMesh 的實機數字需補。

總結：**通過但有限制地通過**。架構與「量測後再最佳化」的工程紀律都建立好了，
剩下的工作是補齊實機數據。

## 尺度修正：放大 House 使 PRD §7 成立（issue #7）

### 決策

- `1 Unit` **維持為「最小可表示單位」**，不錨定現實公尺（符合 PRD §5）。
  所有物件皆不縮放，僅調整 House 幾何。
- **只動 House、不動 Character**（Character 維持 21.5）。「只加門高、不動 House」
  在幾何上不可行——門高受牆高限制，且 House 總高仍 ≤ Character，`House > Human`
  不會成立，因此必須整體放大 House。

### 改動

`src/objects/House.ts` 整體約 1.25 倍放大、高度拉到 31：

| 部位 | 修正前 | 修正後 |
|---|---:|---:|
| 佔地（寬 × 深） | 24 × 18 | 30 × 22 |
| 牆高 | 12 | 18 |
| 門洞高 | 8 | 14 |
| 屋頂總高 | 21 | **31** |
| 屋簷（寬 × 深） | 26 × 20 | 33 × 25 |

`src/world/placement.ts`：House 排除區域半寬 13.5 × 12.5 → **17.5 × 15.5**；
`TREE_RADIUS` 38 → **41**（House 變深後屋簷後緣到 z = -24.5，半徑 38 時樹冠前緣
僅剩 1.2 淨空，加大到 41 恢復約 3.8 的明確淨空）。

`tools/capture-screenshots.mjs`：`03-house-facade` 相機退到 `z = 27`（再往後會撞進
Tree#2 樹冠 z 28.3~42.7）。

### 量測（以程式碼實測，不靠目測）

各物件 bounding box（`/tmp` 量測腳本，`1 Unit = 最小可表示單位`）：

| 物件 | prims | 寬 | 高 | 深 |
|---|---:|---:|---:|---:|
| **House** | 20 | 33.0 | **31.0** | 27.0 |
| Character | 27 | 8.0 | 21.5 | 6.3 |
| Tree | 171 | 14.5 | 27.3 | 14.4 |
| Flower | 7 | 3.0 | 4.0 | 3.0 |
| Ant | 15 | 4.6 | 1.9 | 2.3 |

順序 **House(31) > Human(21.5) > Flower(4) > Ant(1.9)** 成立（Tree 不在 PRD §7 的
排序要求內）。

> **視覺工具誤判紀錄**：`connector__matrix__describe_images` 對 `02-scale-lineup.png`
> 判讀為「Character 明顯比 House 高、比例完全顛倒」，與幾何矛盾。改以 Playwright
> 於 `gl.readPixels` 讀實際 framebuffer 量測輪廓：House 屋頂最高點在畫面 y = 294
> （x ≈ 640 的寬大屋頂結構），Character 最高點在 y = 322 → **House 在畫面上確實高
> 28 px**。再次確認此視覺判讀工具在尺度問題上不可靠，以程式碼 / 像素量測為準。

### 驗證

- `npx tsc --noEmit` = 通過；`npm run build` 通過（525.48 kB / gzip 133.69 kB）。
- 10 張截圖重跑、非空白，`console errors: 0`。
- `03-house-facade.png` 判讀確認整棟 House 完整入鏡、屋頂未被裁切。
- 重新量測 draw call / 三角形未回歸（baseline 20 draw call / 10,958 triangles）。

## PRD §15 Benchmark 欄位對照

PRD §15 要求「不得只回報 FPS」，至少記錄下列欄位。目前狀態：

| PRD §15 要求欄位 | 來源 | 狀態 |
|---|---|---|
| FPS | `PerformanceMonitor` 自行計算 | ✅ |
| Frame Time | `PerformanceMonitor` 自行計算 | ✅ |
| Draw Calls | `renderer.info.render.calls` | ✅ |
| Triangles | `renderer.info.render.triangles` | ✅ |
| **Vertices** | `countVertices`（frustum-aware，見 Phase 2 段落） | ✅ 本輪補上 |
| Visible Objects | `InstanceManager.visibleCount` | ✅ |
| Memory | `performance.memory`（Chrome 專屬，需 `--enable-precise-memory-info`） | ✅（有量化限制，見欄位說明） |

Case A / B / C × Instancing ON / OFF 的矩陣已完整產出於 `report.json`。

## 後續

- 尺度比例：issue #7（**已完成**，House 放大為總高 31）
- 擺放穿模（#12）、Tree 樹冠（#13）、Ant 辨識度（#14）、Character 耳朵：**已修正並複驗**
- Phase 2 效能 Benchmark（#4）：**已完成（SwiftShader）**，實機 GPU 數字待補
- Phase 3 Character A/B 對照（#5）：**已完成**，結論為保留細尺度角色
- Phase 4 花卉 InstancedMesh 最佳化（#6）：**已完成**，200 朵花 draw call 168 → 21
- Phase 5 Review（#9）：**已完成**，7 個問題的回答見上方
- PRD §15 Vertices 欄位：**已完成補上**（frustum-aware，並與三角形數交叉驗證）
- **實機 GPU 效能：issue #4 / #8** — 唯一剩餘項目，需在真實 GPU 上驗證；
  步驟見 [`ON-DEVICE-MEASUREMENT.md`](ON-DEVICE-MEASUREMENT.md)


