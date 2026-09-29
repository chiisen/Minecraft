import Stats from 'stats.js';
import * as THREE from 'three';

import type { DebugReadout } from './DebugPanel';
import { countMeshes, countVertices } from './sceneStats';

/** 每隔多少帧更新一次 renderer.info 讀數（避免每帧都做字串處理）。 */
const SAMPLE_INTERVAL = 10;

/**
 * 效能監控：stats.js 面板 + renderer.info 讀數。
 * 自己計算 FPS / Frame Time，才能把數字餵進 lil-gui 的 Performance 區塊。
 */
export class PerformanceMonitor {
  private readonly stats: Stats;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly readout: DebugReadout;
  private lastTimestamp = performance.now();
  private frames = 0;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    readout: DebugReadout,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.readout = readout;

    this.stats = new Stats();
    this.stats.showPanel(0);
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '0px';
    this.stats.dom.style.left = '0px';
    this.stats.dom.style.zIndex = '10';
    document.body.appendChild(this.stats.dom);
  }

  begin(): void {
    this.stats.begin();
  }

  end(): void {
    this.stats.end();

    const now = performance.now();
    const frameTime = now - this.lastTimestamp;
    this.lastTimestamp = now;
    this.frames += 1;

    const smoothed =
      this.readout.frameTime === 0 ? frameTime : this.readout.frameTime * 0.9 + frameTime * 0.1;
    this.readout.frameTime = smoothed;
    this.readout.fps = smoothed > 0 ? 1000 / smoothed : 0;

    if (this.frames % SAMPLE_INTERVAL === 0) {
      const info = this.renderer.info;
      this.readout.triangles = info.render.triangles;
      this.readout.vertices = countVertices(this.scene, this.camera);
      this.readout.drawCalls = info.render.calls;
      this.readout.objects = countMeshes(this.scene);
    }
  }
}
