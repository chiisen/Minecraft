import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

import { DebugPanel, type SettingKey } from '../debug/DebugPanel';
import type { CameraView, DebugFlagKey, VoxelDebugApi } from '../debug/DevApi';
import { PerformanceMonitor } from '../debug/PerformanceMonitor';
import { MAX_NON_INSTANCED_ANTS } from '../rendering/InstanceManager';
import { DEFAULT_ANT_COUNT, DEFAULT_FLOWER_COUNT, World } from '../world/World';

/** 場景中的 Mesh / InstancedMesh 總數（效能讀數用）。 */
function countMeshes(scene: THREE.Scene): number {
  let count = 0;
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      count += 1;
    }
  });
  return count;
}

/** Chrome 專屬的 JS heap 用量；其他瀏覽器不支援時回傳 null。 */
function readUsedHeapBytes(): number | null {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? memory.usedJSHeapSize : null;
}

/**
 * Game —— 唯一持有 renderer / scene / camera 的地方（避免 global mutable state）。
 * 負責渲染迴圈、自由攝影機，以及把所有子系統接起來。
 */
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: PointerLockControls;
  private readonly container: HTMLElement;
  private readonly keys = new Set<string>();
  private readonly clock = new THREE.Clock();

  private readonly world: World;
  private readonly debugPanel: DebugPanel;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly sun: THREE.DirectionalLight;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fc7e8);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      3000,
    );
    this.camera.position.set(38, 30, 58);

    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.scene.add(this.controls.getObject());

    this.sun = this.setupLighting();
    this.world = new World(this.scene);

    this.debugPanel = new DebugPanel(
      {
        antCount: DEFAULT_ANT_COUNT,
        flowerCount: DEFAULT_FLOWER_COUNT,
        coarseCharacter: false,
        instancing: true,
        lod: true,
        distanceCulling: true,
        shadows: false,
        wireframe: false,
      },
      this.handleSettingChange,
    );

    this.performanceMonitor = new PerformanceMonitor(
      this.renderer,
      this.scene,
      this.debugPanel.readout,
    );

    this.installDebugApi();

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.addEventListener('click', this.handlePointerLock);
  }

  start(): void {
    this.renderer.setAnimationLoop(this.update);
  }

  private setupLighting(): THREE.DirectionalLight {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5a4a, 1.1));

    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(80, 140, 60);
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    this.scene.add(sun);
    return sun;
  }

  /** Debug UI 的所有變更都集中在這裡，避免散落各處。 */
  private readonly handleSettingChange = (key: SettingKey): void => {
    const settings = this.debugPanel.settings;

    switch (key) {
      case 'antCount': {
        const requested = settings.antCount;
        if (!settings.instancing && requested > MAX_NON_INSTANCED_ANTS) {
          this.debugPanel.setNote(`Instancing OFF：已限制為 ${MAX_NON_INSTANCED_ANTS} 隻`);
        } else {
          this.debugPanel.setNote('');
        }
        this.world.ants.setCount(requested);
        break;
      }
      case 'flowerCount':
        this.world.setFlowerCount(settings.flowerCount);
        break;
      case 'coarseCharacter':
        this.world.setCoarseCharacterVisible(settings.coarseCharacter);
        break;
      case 'instancing':
        if (!settings.instancing && settings.antCount > MAX_NON_INSTANCED_ANTS) {
          this.debugPanel.setNote(`Instancing OFF：已限制為 ${MAX_NON_INSTANCED_ANTS} 隻`);
        } else {
          this.debugPanel.setNote('');
        }
        this.world.ants.setInstancing(settings.instancing);
        break;
      case 'lod':
        this.world.ants.setLodEnabled(settings.lod);
        break;
      case 'distanceCulling':
        this.world.setDistanceCulling(settings.distanceCulling);
        break;
      case 'shadows':
        this.applyShadows(settings.shadows);
        break;
      case 'wireframe':
        this.world.material.wireframe = settings.wireframe;
        break;
      default:
        break;
    }
  };

  /**
   * 只在 dev server 註冊除錯 API，供自動截圖 / 驗證腳本使用。
   * Production build 不會包含這段（`import.meta.env.DEV` 會被靜態替換）。
   */
  private installDebugApi(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    const api: VoxelDebugApi = {
      setCamera: ({ position, target }: CameraView) => {
        this.camera.position.set(position[0], position[1], position[2]);
        this.camera.lookAt(target[0], target[1], target[2]);
      },
      setAntCount: (count: number) => {
        this.debugPanel.settings.antCount = count;
        this.debugPanel.refreshDisplay();
        this.handleSettingChange('antCount');
      },
      setFlowerCount: (count: number) => {
        this.debugPanel.settings.flowerCount = count;
        this.debugPanel.refreshDisplay();
        this.handleSettingChange('flowerCount');
      },
      setFlag: (key: DebugFlagKey, value: boolean) => {
        this.debugPanel.settings[key] = value;
        this.debugPanel.refreshDisplay();
        this.handleSettingChange(key);
      },
      getStats: () => ({
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        visibleAnts: this.world.ants.visibleCount,
        fps: this.debugPanel.readout.fps,
        frameTime: this.debugPanel.readout.frameTime,
        objects: countMeshes(this.scene),
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
        usedHeapBytes: readUsedHeapBytes(),
      }),
    };

    (window as unknown as { __voxel?: VoxelDebugApi }).__voxel = api;
  }

  private applyShadows(enabled: boolean): void {
    this.renderer.shadowMap.enabled = enabled;
    this.renderer.shadowMap.needsUpdate = true;
    this.sun.castShadow = enabled;
    this.world.setShadowsEnabled(enabled);
  }

  private readonly update = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.moveCamera(delta);
    this.world.update(this.camera.position);

    this.performanceMonitor.begin();
    this.renderer.render(this.scene, this.camera);
    this.performanceMonitor.end();

    this.debugPanel.readout.ants = this.world.ants.visibleCount;
  };

  private moveCamera(delta: number): void {
    const speed = (this.keys.has('shiftleft') ? 90 : 30) * delta;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();

    const move = new THREE.Vector3();
    if (this.keys.has('keyw')) move.add(forward);
    if (this.keys.has('keys')) move.sub(forward);
    if (this.keys.has('keyd')) move.add(right);
    if (this.keys.has('keya')) move.sub(right);
    if (this.keys.has('space')) move.y += 1;
    if (this.keys.has('controlleft')) move.y -= 1;

    if (move.lengthSq() === 0) return;
    move.normalize().multiplyScalar(speed);
    this.controls.getObject().position.add(move);
  }

  private readonly handleResize = (): void => {
    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code.toLowerCase());
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code.toLowerCase());
  };

  private readonly handlePointerLock = (): void => {
    this.controls.lock();
  };
}
