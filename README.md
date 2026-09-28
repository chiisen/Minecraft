# Minecraft
MinecraftMVP

多尺度體素 (multi-scale voxel) 網頁展示，使用 Three.js + TypeScript + Vite 打造。

## 環境需求

- Node.js 18+（建議 20 LTS 以上）
- npm（隨 Node.js 安裝）

## 安裝

```bash
npm install
```

## 啟動開發伺服器

```bash
npm run dev
```

啟動後依終端機顯示的網址開啟瀏覽器（預設為 http://localhost:5173）。

## 其他指令

```bash
npm run build       # 型別檢查 + 打包正式版
npm run preview     # 預覽打包後的正式版
npm run screenshots # 以 Playwright 擷取驗證截圖（輸出至 docs/verification）
```

## 專案結構

- `src/main.ts`：進入點
- `src/core`、`src/objects`、`src/rendering`、`src/voxel`、`src/world`：核心與場景程式碼
- `src/debug`：除錯面板與開發 API
- `tools/`：輔助腳本（截圖擷取）
- `multi-scale-voxel-web-demo-prd.md`：產品需求文件
