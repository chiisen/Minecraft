# 驗證報告（Phase 1 視覺 / Phase 2 效能 / Phase 3 對照）

本目錄的截圖與 `report.json` 全部由 `tools/capture-screenshots.mjs` 自動產生，可重現。

對應 GitHub issues：

- [#3](https://github.com/chiisen/Minecraft/issues/3) Phase 1 視覺驗證（截圖）
- [#4](https://github.com/chiisen/Minecraft/issues/4) Phase 2 效能 Benchmark（Case A/B/C）
- [#5](https://github.com/chiisen/Minecraft/issues/5) Phase 3 Character 粗 / 細對照實驗

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
4. 量測 Phase 2 Benchmark：Case A/B/C × Instancing ON/OFF 的 draw call、三角形、物件數、記憶體。
5. 檢查每張圖是否為空白帧，並輸出 `report.json`。

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
- **visible**：實際送入 GPU 的螞蟻數（已扣距離剔除與安全上限）。
- **objects**：場景中 `THREE.Mesh` 的總數（`countMeshes`）。
- **geometries / textures**：`renderer.info.memory`。
- **heapMB**：`performance.memory.usedJSHeapSize`（Chrome 專屬）。**此值被 Chrome 量化成
  固定桶**（本輪全部回報 10,000,000 B），解析度不足，**不可用來做 Case 間比較**。

| case | 螞蟻數 | Instancing | Draw calls | Triangles | visible | objects | geometries | heapMB |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| baseline | 0 | ON | 47 | 10,202 | 0 | 59 | 50 | 9.5 |
| A ON | 100 | ON | 49 | 13,730 | 70 | 59 | 50 | 9.5 |
| A OFF | 100 | OFF | 69 | 14,162 | 70 | 1,059 | 50 | 9.5 |
| B ON | 1,000 | ON | 49 | 48,146 | 750 | 1,059 | 50 | 9.5 |
| B OFF | 1,000 | OFF | 244 | 45,662 | 750 | 1,059 | 50 | 9.5 |
| C ON | 10,000 | ON | **49** | 385,358 | 7,437 | 1,059 | 50 | 9.5 |
| C OFF | 10,000 | OFF | 244 | 45,662 | 750 | 1,059 | 50 | 9.5 |

### 結論

1. **Instancing 讓 draw call 與螞蟻數量脫鉤**：10,000 隻仍然是 **49** 個 draw call
   （場景 + 2 個 InstancedMesh）。OFF 模式在 1,000 隻就要 **244** 個 draw call。
   這是 Rule 1（`1 voxel != 1 Three.js Mesh`）在螞蟻上的直接體現。
2. **OFF 模式的 C 列與 B 列完全相同**：因為安全上限 `MAX_NON_INSTANCED_ANTS = 1000`
   生效——刻意不讓頁面崩潰（PRD 要求）。`objects` 在 OFF 模式固定為 1,059
   （場景 57 + 2 個空 InstancedMesh + 1,000 個 fallback mesh），與螞蟻數無關。
3. **ON 模式的三角形數較高是預期行為**：ON 會依 LOD 距離混合 detailed / simplified
   模型；OFF 模式一律使用 detailed 幾何，且被 1,000 上限截斷，所以三角形數反而不隨
   螞蟻數成長。
4. **CPU 軟體渲染下 FPS 無參考價值**：C ON 的 FPS（約 14.6）純粹是 SwiftShader 的
   CPU 光柵化成本，不能推論實機 GPU 表現。實機驗證見 issue #4 / #8。

`console errors: 0`。

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
| 四個尺度（House > Human > Flower > Ant）共存不違和 | ❌ **不通過**（見下方 #7） |
| Character 有 Voxel 特色、不是 Minecraft 式巨大方塊臉 | ✅ 通過 |
| 近看可辨識眼睛 / 眉毛 / 鼻子 / 嘴巴 / 耳朵 / 髮型 | ✅ 通過（耳朵已修正，見下） |
| 遠看維持整體統一視覺語言 | ✅ 通過 |

### 首輪發現的問題與處理

1. **尺度順序錯誤（違反 PRD §7）** — 仍待決策
   House 高 21、Character 高 21.5 → **Human ≥ House**。更明顯的是門高只有 8，
   角色卻是 21.5，等於角色有 2.6 倍門高，根本進不去。轉往 issue
   [#7](https://github.com/chiisen/Minecraft/issues/7)。

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
   > 遮擋）；`TREE_RADIUS` 仍由 34 加大到 38，以消除視覺疑慮並留出明確淨空。

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

## 後續

- 尺度比例：issue #7（**需決策**，目前唯一未通過的檢查項）
- 擺放穿模（#12）、Tree 樹冠（#13）、Ant 辨識度（#14）、Character 耳朵：**已修正並複驗**
- Phase 2 效能 Benchmark（#4）：**已完成（SwiftShader）**，實機 GPU 數字待補
- Phase 3 Character A/B 對照（#5）：**已完成**，結論為保留細尺度角色
- 實機 GPU 效能：issue #4 / #8（需在真實 GPU 上驗證，SwiftShader 的 FPS 無效）
