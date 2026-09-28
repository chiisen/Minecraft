/**
 * 開發模式下掛在 `window.__voxel` 的除錯 API。
 *
 * 用途：讓 `tools/capture-screenshots.mjs` 這類自動化腳本可以精準設定
 * 鏡頭與場景參數，產出可重現的驗證截圖。
 *
 * 只在 dev server 下註冊（`import.meta.env.DEV`），production build 不含此 API。
 */

export interface CameraView {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

/** 可由腳本切換的布林設定（對應 DebugPanel 的 Rendering 區塊）。 */
export type DebugFlagKey = 'instancing' | 'lod' | 'distanceCulling' | 'shadows' | 'wireframe';

export interface VoxelDebugStats {
  /** `renderer.info.render.calls`，與 GPU 後端無關，可用於比較 Draw Call。 */
  readonly drawCalls: number;
  readonly triangles: number;
  readonly visibleAnts: number;
  readonly fps: number;
  readonly frameTime: number;
}

export interface VoxelDebugApi {
  setCamera(view: CameraView): void;
  setAntCount(count: number): void;
  setFlowerCount(count: number): void;
  setFlag(key: DebugFlagKey, value: boolean): void;
  getStats(): VoxelDebugStats;
}
