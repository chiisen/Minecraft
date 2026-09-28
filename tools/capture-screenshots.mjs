/**
 * 自動截圖 harness —— 產出 Phase 1 視覺驗證所需的截圖與數據。
 *
 * 用法：
 *   npm run screenshots
 *
 * 前置：
 *   - devDependencies 需有 playwright（本專案已加入）
 *   - 首次使用需 `npx playwright install chromium`
 *
 * 原理：
 *   1. 啟動 vite dev server（只有 dev 模式會註冊 window.__voxel 除錯 API）
 *   2. 用 headless Chromium + SwiftShader 開啟頁面
 *   3. 透過除錯 API 精準設定鏡頭與場景參數，逐一截圖
 *   4. 量測 Instancing ON/OFF 的 Draw Call / Triangle 數
 *   5. 檢查每張圖是否為空白帧，並輸出報告
 *
 * 注意：SwiftShader 是 CPU 軟體渲染，**FPS 不具參考價值**；
 * Draw Call 與 Triangle 數則與 GPU 後端無關，可作為比較依據。
 */

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'verification');
const PORT = 5197;
const BASE_URL = `http://localhost:${PORT}/`;
const VIEWPORT = { width: 1600, height: 900 };

/**
 * 截圖清單。order 決定檔名前綴。
 *
 * 每個 shot 都明確指定 antCount / flowerCount，讓每張圖可重現、互不污染。
 * 鏡頭位置都是刻意挑過的：
 * - 花的分佈是半徑 8~50 的圓環，相機必須避開（否則會貼在花上），
 *   或直接把 flowerCount 設 0。
 * - `scale-lineup` 的相機取在 House 與 Character 的「等距點」上，
 *   避免透視造成其中一方被放大而誤導尺度判讀。
 */
const SHOTS = [
  {
    name: 'overview',
    note: '預設俯瞰視角，含 ground / house / tree / flower / character / ant',
    antCount: 100,
    flowerCount: 50,
    view: { position: [38, 30, 58], target: [0, 8, 0] },
  },
  {
    name: 'scale-lineup',
    note: '尺度對照：相機位於 House 與 Character 等距點，兩者受透視影響相同；先隱藏螞蟻與花',
    antCount: 0,
    flowerCount: 0,
    view: { position: [-60, 16, 93], target: [-6, 10, -3] },
  },
  {
    name: 'house-facade',
    note: 'House 正面（門面在 +z 側）',
    antCount: 0,
    flowerCount: 0,
    view: { position: [-22, 12, 30], target: [-22, 9, -12] },
  },
  {
    name: 'character-full',
    note: 'Character 全身，檢查身體比例',
    antCount: 0,
    flowerCount: 0,
    view: { position: [10, 11, 30], target: [10, 10, 6] },
  },
  {
    name: 'character-face',
    note: 'Character 頭部特寫，檢查眼睛 / 眉毛 / 鼻 / 嘴 / 髮型',
    antCount: 0,
    flowerCount: 0,
    view: { position: [10, 18, 14], target: [10, 17, 6] },
  },
  {
    name: 'tree',
    note: 'Tree 混合尺度（樹幹 4 → 枝幹 2 → 樹葉 1）',
    antCount: 0,
    flowerCount: 0,
    view: { position: [34, 22, 42], target: [34, 13, 0] },
  },
  {
    name: 'flowers-ground',
    note: '花卉群（200 朵）：相機在花圈外，避免貼在花上',
    antCount: 0,
    flowerCount: 200,
    view: { position: [40, 10, 44], target: [0, 2, 10] },
  },
  {
    name: 'ant-field',
    note: '螞蟻群落（10,000 隻）：整體密度與分佈',
    antCount: 10_000,
    flowerCount: 50,
    view: { position: [0, 24, 70], target: [0, 0, 0] },
  },
  {
    name: 'ant-closeup',
    note: '螞蟻近距離（1,000 隻）：檢查單一個體的身體構造是否可辨識',
    antCount: 1000,
    flowerCount: 0,
    view: { position: [0, 3, 62], target: [0, 0.8, 52] },
  },
];

/**
 * 量測矩陣：比較 Instancing ON / OFF。
 * 第一列 antCount = 0 是基準線，用來扣掉「場景本身」（ground / house / tree / flower）
 * 就貢獻的 draw call 與三角形，讓其他列的螞蟻成本可以被單獨看出來。
 * 注意：`renderer.info.render.triangles` 是整帧總量，含場景其他物件。
 */
const STATS_MATRIX = [
  { antCount: 0, instancing: true, label: 'baseline' },
  { antCount: 100, instancing: true },
  { antCount: 100, instancing: false },
  { antCount: 1000, instancing: true },
  { antCount: 1000, instancing: false },
  { antCount: 10_000, instancing: true },
  { antCount: 10_000, instancing: false },
];

const STATS_VIEW = { position: [0, 20, 40], target: [0, 0, 0] };

function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode === 200) {
          resolve();
          return;
        }
        retry();
      });
      request.on('error', retry);
      request.setTimeout(2000, () => request.destroy());
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`dev server 未能在時限內啟動：${url}`));
        return;
      }
      setTimeout(attempt, 300);
    };
    attempt();
  });
}

/** 判斷截圖是否為空白帧（顏色分佈過於單一即視為失敗）。 */
async function analyzeImage(page, filePath) {
  const dataUrl = `data:image/png;base64,${(await readFile(filePath)).toString('base64')}`;
  return page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

    let r = 0;
    let g = 0;
    let b = 0;
    const buckets = new Set();
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      if (i % 400 === 0) {
        buckets.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`);
      }
    }
    const pixels = data.length / 4;
    return {
      mean: [Math.round(r / pixels), Math.round(g / pixels), Math.round(b / pixels)],
      colorBuckets: buckets.size,
    };
  }, dataUrl);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const server = spawn(
    'npx',
    ['vite', '--port', String(PORT), '--strictPort'],
    { cwd: REPO_ROOT, stdio: 'ignore' },
  );

  const consoleErrors = [];
  let browser;

  try {
    await waitForServer(BASE_URL);

    browser = await chromium.launch({
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: VIEWPORT });

    page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(`console.error: ${message.text()}`);
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.__voxel), undefined, { timeout: 30_000 });
    await page.waitForTimeout(1500);

    // 1) 截圖
    const images = [];
    let index = 0;
    for (const shot of SHOTS) {
      index += 1;
      if (shot.antCount !== undefined) {
        await page.evaluate((n) => window.__voxel.setAntCount(n), shot.antCount);
      }
      if (shot.flowerCount !== undefined) {
        await page.evaluate((n) => window.__voxel.setFlowerCount(n), shot.flowerCount);
      }
      await page.evaluate((view) => window.__voxel.setCamera(view), shot.view);
      await page.waitForTimeout(700);

      const file = path.join(OUT_DIR, `${String(index).padStart(2, '0')}-${shot.name}.png`);
      await page.screenshot({ path: file });
      const analysis = await analyzeImage(page, file);
      images.push({ file: path.basename(file), note: shot.note, ...analysis });
    }

    // 2) Instancing ON/OFF 量測
    await page.evaluate((n) => window.__voxel.setFlowerCount(n), 50);
    await page.evaluate((view) => window.__voxel.setCamera(view), STATS_VIEW);

    const stats = [];
    for (const entry of STATS_MATRIX) {
      await page.evaluate((value) => window.__voxel.setFlag('instancing', value), entry.instancing);
      await page.evaluate((n) => window.__voxel.setAntCount(n), entry.antCount);
      await page.waitForTimeout(900);
      const measured = await page.evaluate(() => window.__voxel.getStats());
      stats.push({ ...entry, ...measured });
    }

    // 3) 報告
    const report = {
      capturedAt: new Date().toISOString(),
      renderer: 'headless Chromium / SwiftShader（CPU 軟體渲染，FPS 無參考價值）',
      viewport: VIEWPORT,
      consoleErrors,
      images,
      instancingComparison: stats,
    };

    await writeFile(
      path.join(OUT_DIR, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );

    console.log(`\n截圖輸出：${path.relative(REPO_ROOT, OUT_DIR)}`);
    for (const image of images) {
      const blank = image.colorBuckets < 20 ? '  ⚠️ 疑似空白帧' : '';
      console.log(`  ${image.file}  mean=${image.mean.join(',')}  buckets=${image.colorBuckets}${blank}`);
    }

    console.log('\nInstancing 比較（SwiftShader，FPS 僅供參考）：');
    console.log('  ants    instancing  drawCalls  triangles  visibleAnts');
    for (const row of stats) {
      console.log(
        `  ${String(row.antCount).padStart(6)}  ${row.instancing ? 'ON ' : 'OFF'}        ${String(
          row.drawCalls,
        ).padStart(9)}  ${String(row.triangles).padStart(9)}  ${String(row.visibleAnts).padStart(11)}`,
      );
    }

    console.log(
      `\nconsole errors: ${consoleErrors.length === 0 ? '0 ✅' : `${consoleErrors.length} ❌`}`,
    );
    for (const error of consoleErrors) {
      console.log(`  - ${error}`);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    server.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
