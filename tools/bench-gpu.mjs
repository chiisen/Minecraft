/**
 * 實機 GPU 效能量測 harness（issue #8 / PRD §21）。
 *
 * 用法：
 *   npm run bench:gpu
 *
 * 與 `capture-screenshots.mjs` 的差別：
 *   - 那一支強制走 SwiftShader（CPU 軟體渲染），FPS 沒有參考價值，只能量結構數字。
 *   - 這一支**不帶** SwiftShader 參數，改用機器上的真實 GPU，因此 FPS / Frame Time
 *     可以用來驗收 PRD §21 的「1920×1080 / 60 FPS」。
 *
 * 兩支寫不同的檔案，避免真機數據覆蓋掉 CI 可重現的 SwiftShader 基準。
 *
 * 量測原則：
 *   - 每個 Case 換設定後先「暖身」1.5 秒（等 shader 編譯與指數平滑收斂）。
 *   - 再取樣 3 次、每次間隔 1 秒，回報中位數，避免單帧跳動誤導。
 *   - 開跑前先驗證 renderer 字串，**若意外退回 SwiftShader 就中止**，
 *     否則會拿到一份看起來正常、實際無效的報告。
 */

import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'verification');
const PORT = 5198;
const BASE_URL = `http://localhost:${PORT}/`;

/** PRD §21 指定 1920×1080。 */
const VIEWPORT = { width: 1920, height: 1080 };

/** 固定鏡頭，確保每個 Case 的相對位置與可見數量一致。 */
const STATS_VIEW = { position: [0, 20, 40], target: [0, 0, 0] };

const WARMUP_MS = 1500;
const SAMPLE_INTERVAL_MS = 1000;
const SAMPLE_COUNT = 3;

/**
 * 量測矩陣。
 *
 * 前七列對應 PRD §15 的 Case A/B/C × Instancing ON/OFF；
 * 最後兩列是 issue #8 的重點——Shadows ON 時的 10,000 隻 InstancedMesh。
 */
const MATRIX = [
  { label: 'baseline', antCount: 0, instancing: true, shadows: false, case: null },
  { label: 'A ON', antCount: 100, instancing: true, shadows: false, case: 'A' },
  { label: 'A OFF', antCount: 100, instancing: false, shadows: false, case: 'A' },
  { label: 'B ON', antCount: 1000, instancing: true, shadows: false, case: 'B' },
  { label: 'B OFF', antCount: 1000, instancing: false, shadows: false, case: 'B' },
  { label: 'C ON', antCount: 10_000, instancing: true, shadows: false, case: 'C' },
  { label: 'C OFF', antCount: 10_000, instancing: false, shadows: false, case: 'C' },
  { label: 'C SHADOW ON', antCount: 10_000, instancing: true, shadows: true, case: 'C8' },
  { label: 'C SHADOW OFF', antCount: 10_000, instancing: true, shadows: false, case: 'C8' },
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

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
      function retry() {
        if (Date.now() > deadline) {
          reject(new Error(`vite dev server 未在 ${timeoutMs}ms 內就緒`));
          return;
        }
        setTimeout(attempt, 300);
      }
    };
    attempt();
  });
}

/** 取中位數；null 代表該項在本次量測中不可得。 */
function medianOrNull(values) {
  const usable = values.filter((value) => value !== null && Number.isFinite(value));
  return usable.length === 0 ? null : median(usable);
}

/** 各平台的 ANGLE 後端；headless Chromium 不加參數時一律退回 SwiftShader。 */
function gpuArgs({ uncapFrameRate = false } = {}) {
  const base =
    process.platform === 'darwin'
      ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']
      : process.platform === 'win32'
        ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']
        : ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

  if (!uncapFrameRate) {
    return base;
  }
  // 解除 vsync 與顯示器刷新率上限，才能量到「GPU 實際跑多快」而非被 60 Hz 頂住。
  return [...base, '--disable-gpu-vsync', '--disable-frame-rate-limit'];
}

async function main() {
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
  });

  const consoleErrors = [];
  let renderer = 'unknown';

  /**
   * 跑一輪完整矩陣。
   *
   * @param {boolean} uncapFrameRate 解除 vsync / 刷新率上限。
   *   false → 反映真實使用體驗（被螢幕 60 Hz 頂住），用來驗收 PRD §21。
     *   true  → 量到 GPU 實際能跑多快，用來看「離瓶頸還有多遠」。
   */
  async function runPass(uncapFrameRate) {
    // 刻意不帶 --use-angle=swiftshader：改用機器上的真實 GPU（見 gpuArgs）。
    const browser = await chromium.launch({ args: gpuArgs({ uncapFrameRate }) });
    try {
      const page = await browser.newPage({ viewport: VIEWPORT });

      page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(`console.error: ${message.text()}`);
        }
      });

      await page.goto(BASE_URL, { waitUntil: 'load' });
      await page.waitForFunction(() => Boolean(window.__voxel), undefined, { timeout: 30_000 });

      // 驗證真的拿到硬體加速；退回軟體渲染就中止，避免產出無效報告。
      const detected = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return 'unknown';
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      });

      if (/swiftshader|software/i.test(detected)) {
        throw new Error(
          `偵測到軟體渲染（${detected}）。請在有 GPU 的機器上執行，` +
            '或改用 tools/capture-screenshots.mjs（那份只取結構數字）。',
        );
      }
      renderer = detected;

      await page.waitForTimeout(1500);

      // 固定所有渲染開關，只由矩陣逐列切換 instancing / shadows。
      await page.evaluate(() => {
        window.__voxel.setFlag('lod', true);
        window.__voxel.setFlag('distanceCulling', true);
        window.__voxel.setFlag('wireframe', false);
        window.__voxel.setFlag('coarseCharacter', false);
        window.__voxel.setFlowerCount(50);
        window.__voxel.setCamera({ position: [0, 20, 40], target: [0, 0, 0] });
      });

      const rows = [];
      for (const entry of MATRIX) {
        await page.evaluate(
          ([instancing, shadows]) => {
            window.__voxel.setFlag('instancing', instancing);
            window.__voxel.setFlag('shadows', shadows);
          },
          [entry.instancing, entry.shadows],
        );
        await page.evaluate((n) => window.__voxel.setAntCount(n), entry.antCount);
        await page.waitForTimeout(WARMUP_MS);

        const fpsSamples = [];
        const frameTimeSamples = [];
        let last = null;
        for (let i = 0; i < SAMPLE_COUNT; i += 1) {
          await page.waitForTimeout(SAMPLE_INTERVAL_MS);
          last = await page.evaluate(() => window.__voxel.getStats());
          fpsSamples.push(last.fps);
          frameTimeSamples.push(last.frameTime);
        }

        const row = {
          ...entry,
          drawCalls: last.drawCalls,
          triangles: last.triangles,
          vertices: last.vertices,
          visibleAnts: last.visibleAnts,
          objects: last.objects,
          geometries: last.geometries,
          textures: last.textures,
          fps: medianOrNull(fpsSamples),
          frameTimeMs: medianOrNull(frameTimeSamples),
          usedHeapBytes: last.usedHeapBytes,
        };
        rows.push(row);

        const heapMb = row.usedHeapBytes === null ? 'n/a' : (row.usedHeapBytes / 1048576).toFixed(1);
        console.log(
          `  ${String(row.label).padEnd(14)} ants=${String(row.antCount).padStart(5)} ` +
            `inst=${row.instancing ? 'ON ' : 'OFF'} shadow=${row.shadows ? 'ON ' : 'OFF'} | ` +
            `FPS ${(row.fps ?? 0).toFixed(1).padStart(7)} | ` +
            `frame ${(row.frameTimeMs ?? 0).toFixed(2).padStart(7)} ms | ` +
            `draw ${String(row.drawCalls).padStart(3)} | ` +
            `tri ${String(row.triangles).padStart(6)} | ` +
            `vert ${String(row.vertices).padStart(7)} | ` +
            `vis ${String(row.visibleAnts).padStart(4)} | ` +
            `obj ${String(row.objects).padStart(4)} | ` +
            `geo ${String(row.geometries).padStart(2)} | ` +
            `heap ${heapMb.padStart(6)} MB`,
        );
      }
      return rows;
    } finally {
      await browser.close();
    }
  }

  try {
    await waitForServer(BASE_URL);

    console.log('\n【Pass 1】vsync 鎖定（反映真實使用體驗，對應 PRD §21）');
    const vsyncRows = await runPass(false);

    console.log('\n【Pass 2】解除 vsync / 刷新率上限（量 GPU 實際上限，看效能餘裕）');
    const uncappedRows = await runPass(true);

    const report = {
      capturedAt: new Date().toISOString(),
      note:
        '實機 GPU 量測（issue #8 / PRD §21）。FPS 為 3 次取樣的中位數，每個 Case 先暖身 1.5 秒。' +
        'vsyncLocked 反映真實使用體驗（被螢幕刷新率頂住）；uncapped 解除上限，量 GPU 實際能跑多快。' +
        '與 report.json（SwiftShader）的 FPS 不可直接比較。',
      renderer,
      platform: `${process.platform} ${process.arch}`,
      viewport: VIEWPORT,
      sampling: { warmupMs: WARMUP_MS, intervalMs: SAMPLE_INTERVAL_MS, count: SAMPLE_COUNT },
      consoleErrors,
      vsyncLocked: vsyncRows,
      uncapped: uncappedRows,
    };

    await writeFile(
      path.join(OUT_DIR, 'report-gpu.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );

    console.log(`\nrenderer: ${renderer}`);
    console.log(`輸出：${path.relative(REPO_ROOT, path.join(OUT_DIR, 'report-gpu.json'))}`);
    console.log(
      `console errors: ${consoleErrors.length === 0 ? '0 ✅' : `${consoleErrors.length} ❌`}`,
    );
    for (const error of consoleErrors) {
      console.log(`  - ${error}`);
    }

    // PRD §21 只要求「60 FPS」，而 vsync pass 的 60 Hz 天花板本來就是 60，
    // 因此以 58 為門檻留出量測雜訊，實質上就是「有沒有掉幀」。
    const dropped = vsyncRows.filter((row) => (row.fps ?? 0) < 58);
    console.log(
      `\nPRD §21（1920×1080 / 60 FPS）：${
        dropped.length === 0 ? '全部達標，無掉幀 ✅' : `${dropped.length} 個 Case 掉幀 ⚠️`
      }`,
    );
    const worst = uncappedRows.reduce((min, row) => Math.min(min, row.fps ?? Infinity), Infinity);
    console.log(
      `解除 vsync 後最慢 Case：${worst.toFixed(1)} FPS（距瓶頸的餘裕）`,
    );
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
