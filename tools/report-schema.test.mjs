/**
 * `tools/report-schema.mjs` 的測試（issue #16）。
 *
 * 用專案既有的 Vitest 執行（`npm test`）；驗證器本身零依賴。
 * 除了驗證 schema 邏輯，也用**實際 commit 的報告檔**做回歸鎖定，
 * 確保 generator 改動把欄位弄丟時這裡會先亮紅燈。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { assertReport, validateReport } from './report-schema.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERIFICATION_DIR = path.join(REPO_ROOT, 'docs', 'verification');

/** 讀入實際 commit 的報告並回傳可安全改動的副本。 */
function readReport(fileName) {
  return structuredClone(JSON.parse(readFileSync(path.join(VERIFICATION_DIR, fileName), 'utf8')));
}

describe('實際報告檔', () => {
  it('report.json 通過 screenshots schema', () => {
    expect(validateReport(readReport('report.json'), 'screenshots')).toEqual([]);
  });

  it('report-gpu.json 通過 gpu schema', () => {
    expect(validateReport(readReport('report-gpu.json'), 'gpu')).toEqual([]);
  });
});

describe('validateReport', () => {
  it('缺少頂層欄位會被指出', () => {
    const report = readReport('report-gpu.json');
    delete report.renderer;

    const errors = validateReport(report, 'gpu');
    expect(errors).toContain('gpu.renderer: 缺少欄位');
  });

  it('缺少資料列欄位會被指出（含陣列索引）', () => {
    const report = readReport('report.json');
    delete report.instancingComparison[0].vertices;

    const errors = validateReport(report, 'screenshots');
    expect(errors).toContain('screenshots.instancingComparison[0].vertices: 缺少欄位');
  });

  it('型別錯誤會被指出', () => {
    const report = readReport('report.json');
    report.instancingComparison[0].triangles = '45698';

    const errors = validateReport(report, 'screenshots');
    expect(errors).toContain('screenshots.instancingComparison[0].triangles: 預期有限數值，實際為 "45698"');
  });

  it('數值欄位不接受 NaN / Infinity', () => {
    const report = readReport('report.json');
    report.instancingComparison[0].drawCalls = Number.POSITIVE_INFINITY;

    const errors = validateReport(report, 'screenshots');
    expect(errors).toContain('screenshots.instancingComparison[0].drawCalls: 預期有限數值，實際為 Infinity');
  });

  it('可為 null 的欄位接受 null，不可為 null 的欄位拒絕 null', () => {
    const report = readReport('report-gpu.json');
    const row = report.vsyncLocked[0];

    row.fps = null; // schema 允許（量測不可得）
    expect(validateReport(report, 'gpu')).toEqual([]);

    row.vertices = null; // schema 不允許
    const errors = validateReport(report, 'gpu');
    expect(errors).toContain('gpu.vsyncLocked[0].vertices: 預期 number，實際為 null');
  });

  it('陣列元素型別錯誤會被指出', () => {
    const report = readReport('report.json');
    report.consoleErrors.push(42);

    const errors = validateReport(report, 'screenshots');
    expect(errors).toContain('screenshots.consoleErrors[0]: 預期 string，實際為 number');
  });

  it('未知的報告類型會丟出錯誤', () => {
    expect(() => validateReport({}, 'unknown')).toThrow(/未知的報告類型/);
  });
});

describe('assertReport', () => {
  it('通過時不丟錯', () => {
    expect(() => assertReport(readReport('report.json'), 'screenshots')).not.toThrow();
  });

  it('失敗時丟出含錯誤清單的錯誤', () => {
    const broken = readReport('report.json');
    delete broken.images;

    expect(() => assertReport(broken, 'screenshots')).toThrow(/報告 schema 驗證失敗（screenshots/);
  });
});
