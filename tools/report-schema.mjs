/**
 * Benchmark 報告 schema 定義與驗證（issue #16）。
 *
 * 目的：`docs/verification/report.json`（SwiftShader 截圖 / Phase 2 Benchmark）與
 * `docs/verification/report-gpu.json`（實機 GPU 量測）的欄位是手動演進的，格式跑掉
 * 不會有警訊。這裡用一份**零依賴**的描述式 schema 鎖住欄位與型別，讓兩支 generator
 * 在寫檔前先驗證，缺欄位或型別錯誤就直接報錯、不產出「看起來正常但缺欄位」的報告。
 *
 * PRD §15 要求記錄的欄位對照：
 *   - FPS            → row.fps
 *   - Frame Time     → row.frameTime（report.json） / row.frameTimeMs（report-gpu.json）
 *   - Draw Calls     → row.drawCalls
 *   - Triangles      → row.triangles
 *   - Vertices       → row.vertices
 *   - Visible Objects→ row.visibleAnts（可見個體數）/ row.objects（場景物件數）
 *   - Memory         → row.usedHeapBytes
 *
 * 型別描述語法：
 *   - `'string'` / `'number'` / `'boolean'`：該型別，`number` 額外要求有限值。
 *   - 尾綴 `?`（例如 `'number?'`）：允許 `null`，代表該項在本次量測不可得。
 *   - `{ ... }`：物件，逐欄位檢查，缺欄位即報錯。
 *   - `[ spec ]`：陣列，逐一檢查元素。
 */

/** 場景圖片分析結果（report.json 的 `images[]`）。 */
const IMAGE_SCHEMA = {
  file: 'string',
  note: 'string',
  mean: ['number'],
  colorBuckets: 'number',
};

/** report.json 的 benchmark 資料列（來自 window.__voxel.getStats）。 */
const SCREENSHOT_ROW_SCHEMA = {
  antCount: 'number',
  instancing: 'boolean',
  label: 'string',
  case: 'string?',
  drawCalls: 'number',
  triangles: 'number',
  vertices: 'number',
  visibleAnts: 'number',
  fps: 'number?',
  frameTime: 'number?',
  objects: 'number',
  geometries: 'number',
  textures: 'number',
  usedHeapBytes: 'number?',
};

/** report-gpu.json 的資料列；多了 shadows，且 Frame Time 欄位名為 frameTimeMs。 */
const GPU_ROW_SCHEMA = {
  label: 'string',
  antCount: 'number',
  instancing: 'boolean',
  shadows: 'boolean',
  case: 'string?',
  drawCalls: 'number',
  triangles: 'number',
  vertices: 'number',
  visibleAnts: 'number',
  objects: 'number',
  geometries: 'number',
  textures: 'number',
  fps: 'number?',
  frameTimeMs: 'number?',
  usedHeapBytes: 'number?',
};

/**
 * 兩種報告的 schema。
 *
 * key 同時是 `assertReport` 的 `kind` 參數值。
 */
export const REPORT_SCHEMAS = {
  screenshots: {
    capturedAt: 'string',
    renderer: 'string',
    viewport: { width: 'number', height: 'number' },
    consoleErrors: ['string'],
    images: [IMAGE_SCHEMA],
    instancingComparison: [SCREENSHOT_ROW_SCHEMA],
  },
  gpu: {
    capturedAt: 'string',
    note: 'string',
    renderer: 'string',
    platform: 'string',
    viewport: { width: 'number', height: 'number' },
    sampling: { warmupMs: 'number', intervalMs: 'number', count: 'number' },
    consoleErrors: ['string'],
    vsyncLocked: [GPU_ROW_SCHEMA],
    uncapped: [GPU_ROW_SCHEMA],
  },
};

function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function validateValue(value, spec, path, errors) {
  if (typeof spec === 'string') {
    const nullable = spec.endsWith('?');
    const expected = nullable ? spec.slice(0, -1) : spec;
    if (value === null) {
      if (!nullable) {
        errors.push(`${path}: 預期 ${expected}，實際為 null`);
      }
      return;
    }
    if (expected === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        const shown = typeof value === 'number' ? String(value) : JSON.stringify(value);
        errors.push(`${path}: 預期有限數值，實際為 ${shown}`);
      }
      return;
    }
    if (typeof value !== expected) {
      errors.push(`${path}: 預期 ${expected}，實際為 ${describe(value)}`);
    }
    return;
  }

  if (Array.isArray(spec)) {
    if (!Array.isArray(value)) {
      errors.push(`${path}: 預期陣列，實際為 ${describe(value)}`);
      return;
    }
    const [itemSpec] = spec;
    value.forEach((item, index) => validateValue(item, itemSpec, `${path}[${index}]`, errors));
    return;
  }

  if (spec && typeof spec === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path}: 預期物件，實際為 ${describe(value)}`);
      return;
    }
    for (const [key, childSpec] of Object.entries(spec)) {
      if (!(key in value)) {
        errors.push(`${path}.${key}: 缺少欄位`);
        continue;
      }
      validateValue(value[key], childSpec, `${path}.${key}`, errors);
    }
    return;
  }

  errors.push(`${path}: 未知的 schema 描述 ${JSON.stringify(spec)}`);
}

/**
 * 驗證報告並回傳所有錯誤（空陣列代表通過）。
 *
 * @param {unknown} report 已解析的報告物件。
 * @param {'screenshots' | 'gpu'} kind 報告類型。
 * @returns {string[]} 錯誤訊息清單。
 */
export function validateReport(report, kind) {
  const schema = REPORT_SCHEMAS[kind];
  if (schema === undefined) {
    throw new Error(`未知的報告類型：${kind}（可用：${Object.keys(REPORT_SCHEMAS).join(', ')}）`);
  }
  const errors = [];
  validateValue(report, schema, kind, errors);
  return errors;
}

/**
 * 驗證報告，失敗即丟出錯誤。供 generator 在寫檔前呼叫。
 *
 * @param {unknown} report 已解析的報告物件。
 * @param {'screenshots' | 'gpu'} kind 報告類型。
 */
export function assertReport(report, kind) {
  const errors = validateReport(report, kind);
  if (errors.length > 0) {
    throw new Error(
      `報告 schema 驗證失敗（${kind}，共 ${errors.length} 項）：\n` +
        errors.map((error) => `  - ${error}`).join('\n'),
    );
  }
}
