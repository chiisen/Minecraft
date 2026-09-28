# Phase 1 視覺驗證（自動截圖）

對應 GitHub issue [#3](https://github.com/chiisen/Minecraft/issues/3)。
本目錄的截圖與 `report.json` 全部由 `tools/capture-screenshots.mjs` 自動產生，可重現。

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
4. 量測 Instancing ON / OFF 的 draw call 與三角形數。
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
| `03-house-facade.png` | House 正面 | 正面 |
| `04-character-full.png` | Character 全身 | 正面平視 |
| `05-character-face.png` | Character 頭部特寫 | 特寫 |
| `06-tree.png` | Tree 混合尺度 | 側面 |
| `07-flowers-ground.png` | 花卉群 200 朵 | 花圈外 |
| `08-ant-field.png` | 螞蟻 10,000 隻 | 俯瞰 |
| `09-ant-closeup.png` | 螞蟻 1,000 隻 | 近距離 |

鏡頭位置是刻意挑的：

- 花的分佈是**半徑 8~50 的圓環**。相機若落在圓環內會直接貼在花上（第一版 harness 的
  `07` 與 `09` 就是這樣，畫面被一整塊花瓣蓋住）。現在 `07` 的相機在圓環外，`09` 直接
  把 `flowerCount` 設 0。
- `02-scale-lineup` 的相機取在 House 與 Character 的**等距點**上，否則透視會讓其中一方
  被放大而誤導尺度判讀。

## 量測結果（`report.json`）

`renderer.info.render.triangles` 是**整帧總量**，含場景其他物件，所以第一列 `antCount = 0`
是基準線，用來扣掉場景本身。

| 螞蟻數 | Instancing | Draw calls | Triangles | 實際送出 |
|---:|---|---:|---:|---:|
| 0（基準線） | — | 47 | 5,102 | 0 |
| 100 | ON | 49 | 9,278 | 66 |
| 100 | OFF | 75 | 9,470 | 66 |
| 1,000 | ON | 49 | 48,254 | 672 |
| 1,000 | OFF | 284 | 42,074 | 672 |
| 10,000 | ON | **49** | 429,962 | 6,545 |
| 10,000 | OFF | 284 | 42,074 | 672 |

兩個重點：

1. **Instancing 讓 draw call 與螞蟻數量脫鉤**：10,000 隻仍然是 49 個 draw call（2 個
   InstancedMesh + 場景）。OFF 模式在 1,000 隻就要 284 個 draw call。
2. **OFF 模式的 10,000 那列與 1,000 完全相同**，因為安全上限
   `MAX_NON_INSTANCED_ANTS = 1000` 生效——刻意不讓頁面崩潰（PRD 要求）。

三角形數在 ON 模式較高是預期行為：ON 會依 LOD 距離混合 detailed / simplified 模型，而
OFF 模式一律使用 detailed 幾何。

`console errors: 0`。

## 驗證結論（對照 issue #3 的檢查項）

| 檢查項 | 結果 |
|---|---|
| 四個尺度（House > Human > Flower > Ant）共存不違和 | ❌ **不通過** |
| Character 有 Voxel 特色、不是 Minecraft 式巨大方塊臉 | ✅ 通過 |
| 近看可辨識眼睛 / 眉毛 / 鼻子 / 嘴巴 / 耳朵 / 髮型 | ⚠️ 部分通過（耳朵不可見） |
| 遠看維持整體統一視覺語言 | ✅ 通過 |

### 發現的問題

1. **尺度順序錯誤（違反 PRD §7）**
   House 高 21、Character 高 21.5 → **Human ≥ House**。更明顯的是門高只有 8，
   角色卻是 21.5，等於角色有 2.6 倍門高，根本進不去。轉往 issue
   [#7](https://github.com/chiisen/Minecraft/issues/7)。

2. **物件擺放互相穿模**
   Character 站在 (10, 6)，正好落在 House 屋頂的佔地範圍（x ±13、z ±10）內，
   頭部直接插進屋簷。花與螞蟻是隨機撒在整個圓環／圓盤上，沒有避開建築，
   因此會穿過門板與牆面。

3. **Tree 樹冠不成形**
   `addCanopy()` 在 46 次取樣、半徑 8 的球內只成功放進 22~33 顆 1~2 單位方塊
   （體積覆蓋率僅 3.5%~5.2%），視覺上就是一堆**懸空、彼此不相連的綠色方塊**。

4. **螞蟻近距離無法辨識**
   10,000 隻撒在半徑 100 的圓盤上，平均間距約 1.77 單位，但螞蟻體長 3.6 單位 →
   大量互相穿透。加上體色 `0x2b1d16` 過暗，近看是一團深色方塊，看不出頭／胸／腹／腳。

5. **Character 耳朵被頭髮完全遮住**（次要）
   耳朵在 x = ±2.6、寬 0.5；頭髮側片在 x = ±2.7、寬 0.6，正好蓋住耳朵。
   屬於 Phase 3（issue [#5](https://github.com/chiisen/Minecraft/issues/5)）的改善範圍。

## 後續

- 尺度比例：issue #7（需決策）
- 擺放穿模、Tree 樹冠、Ant 辨識度：已建立後續 issue
- Character 耳朵：併入 issue #5
