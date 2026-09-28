import * as THREE from 'three';

/**
 * 大量微型物件（Ant）的實例化管理。
 *
 * 負責三件 PRD 要求的事：
 * - Instancing ON/OFF（OFF 有安全上限，避免瀏覽器崩潰）
 * - Distance Culling（距離過遠的個體不送入 GPU）
 * - LOD（遠處改用簡化模型，以兩個 InstancedMesh 分艙）
 *
 * 所有個體的變換都是「預先算好」的，執行期只做挑選與寫入，
 * 因此不會變成 1 ant = 1 Object3D。
 */

export interface AntTransform {
  readonly x: number;
  readonly z: number;
  readonly rotationY: number;
}

/** 沒有 Instancing 時的安全上限：超過就只畫這麼多。 */
export const MAX_NON_INSTANCED_ANTS = 1000;

/** 相機移動超過此距離才重建實例矩陣，避免每帧重算。 */
const REBUILD_DISTANCE = 2;

export class InstanceManager {
  private readonly scene: THREE.Scene;
  private readonly detailed: THREE.InstancedMesh;
  private readonly simplified: THREE.InstancedMesh;
  private readonly transforms: readonly AntTransform[];
  private readonly matrix = new THREE.Matrix4();
  private readonly lastCameraPosition = new THREE.Vector3(Number.POSITIVE_INFINITY, 0, 0);

  private fallbackMeshes: THREE.Mesh[] | null = null;
  private count: number;
  private instancing = true;
  private lodEnabled = true;
  private distanceCulling = true;
  private hasCameraPosition = false;
  private cullDistance: number;
  private lodDistance: number;

  constructor(
    scene: THREE.Scene,
    detailedGeometry: THREE.BufferGeometry,
    simplifiedGeometry: THREE.BufferGeometry,
    material: THREE.Material,
    transforms: readonly AntTransform[],
    options: { readonly cullDistance: number; readonly lodDistance: number },
  ) {
    this.scene = scene;
    this.transforms = transforms;
    this.count = transforms.length;
    this.cullDistance = options.cullDistance;
    this.lodDistance = options.lodDistance;

    this.detailed = this.createInstancedMesh(detailedGeometry, material, 'Ants_Detailed');
    this.simplified = this.createInstancedMesh(simplifiedGeometry, material, 'Ants_Simplified');
  }

  /** PRD 要求的 100 / 1,000 / 10,000 快速切換。 */
  setCount(count: number): void {
    this.count = Math.max(0, Math.min(Math.round(count), this.transforms.length));
    this.apply();
  }

  setInstancing(enabled: boolean): void {
    this.instancing = enabled;
    this.apply();
  }

  setLodEnabled(enabled: boolean): void {
    this.lodEnabled = enabled;
    this.apply();
  }

  setDistanceCulling(enabled: boolean): void {
    this.distanceCulling = enabled;
    this.apply();
  }

  /** 每帧呼叫；相機移動足夠多才會真的重建。 */
  update(cameraPosition: THREE.Vector3): void {
    const moved =
      this.lastCameraPosition.distanceToSquared(cameraPosition) > REBUILD_DISTANCE * REBUILD_DISTANCE;
    if (!moved) {
      return;
    }
    this.hasCameraPosition = true;
    this.lastCameraPosition.copy(cameraPosition);
    this.apply();
  }

  /**
   * 目前實際送出渲染的個體數（供 Debug UI 顯示）。
   * Instancing ON 時是兩個 InstancedMesh 的 instance 總數；
   * OFF 時是真正設為 visible 的 fallback mesh 數量（已扣掉距離剔除與安全上限）。
   */
  get visibleCount(): number {
    if (this.instancing) {
      return this.detailed.count + this.simplified.count;
    }
    if (!this.fallbackMeshes) {
      return 0;
    }
    let visible = 0;
    for (const mesh of this.fallbackMeshes) {
      if (mesh.visible) {
        visible += 1;
      }
    }
    return visible;
  }

  private createInstancedMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, this.transforms.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.name = name;
    this.scene.add(mesh);
    return mesh;
  }

  private apply(): void {
    if (this.instancing) {
      this.hideFallbackMeshes();
      this.rebuildInstances();
      return;
    }

    this.detailed.count = 0;
    this.simplified.count = 0;
    this.detailed.instanceMatrix.needsUpdate = true;
    this.simplified.instanceMatrix.needsUpdate = true;
    this.rebuildFallbackMeshes();
  }

  private rebuildInstances(): void {
    const camera = this.lastCameraPosition;
    const culling = this.distanceCulling && this.hasCameraPosition;
    const cullDistanceSquared = this.cullDistance * this.cullDistance;
    const lodDistanceSquared = this.lodDistance * this.lodDistance;

    let detailedCount = 0;
    let simplifiedCount = 0;

    for (let i = 0; i < this.count; i += 1) {
      const transform = this.transforms[i] as AntTransform;
      const dx = transform.x - camera.x;
      const dz = transform.z - camera.z;
      // 尚未取得相機位置時視為最近，避免初始狀態被誤判為遠處而全部 LOD / 剔除。
      const distanceSquared = this.hasCameraPosition ? dx * dx + dz * dz : 0;

      if (culling && distanceSquared > cullDistanceSquared) {
        continue;
      }

      this.matrix.makeRotationY(transform.rotationY);
      this.matrix.setPosition(transform.x, 0, transform.z);

      if (this.lodEnabled && distanceSquared > lodDistanceSquared) {
        this.simplified.setMatrixAt(simplifiedCount, this.matrix);
        simplifiedCount += 1;
      } else {
        this.detailed.setMatrixAt(detailedCount, this.matrix);
        detailedCount += 1;
      }
    }

    this.detailed.count = detailedCount;
    this.simplified.count = simplifiedCount;
    this.detailed.instanceMatrix.needsUpdate = true;
    this.simplified.instanceMatrix.needsUpdate = true;
    this.detailed.computeBoundingSphere();
    this.simplified.computeBoundingSphere();
  }

  private ensureFallbackMeshes(): THREE.Mesh[] {
    if (this.fallbackMeshes) {
      return this.fallbackMeshes;
    }
    // 共用同一個 Geometry 與 Material，只是各自一個 Mesh（無 Instancing 對照組）。
    const meshes: THREE.Mesh[] = [];
    const limit = Math.min(this.transforms.length, MAX_NON_INSTANCED_ANTS);
    for (let i = 0; i < limit; i += 1) {
      const mesh = new THREE.Mesh(this.detailed.geometry, this.detailed.material);
      mesh.visible = false;
      mesh.name = `Ant_Fallback_${i}`;
      this.scene.add(mesh);
      meshes.push(mesh);
    }
    this.fallbackMeshes = meshes;
    return meshes;
  }

  private rebuildFallbackMeshes(): void {
    const meshes = this.ensureFallbackMeshes();
    const camera = this.lastCameraPosition;
    const culling = this.distanceCulling && this.hasCameraPosition;
    const cullDistanceSquared = this.cullDistance * this.cullDistance;
    const visible = Math.min(this.count, meshes.length);

    for (let i = 0; i < meshes.length; i += 1) {
      const mesh = meshes[i] as THREE.Mesh;
      if (i >= visible) {
        mesh.visible = false;
        continue;
      }
      const transform = this.transforms[i] as AntTransform;
      mesh.position.set(transform.x, 0, transform.z);
      mesh.rotation.y = transform.rotationY;
      const dx = transform.x - camera.x;
      const dz = transform.z - camera.z;
      mesh.visible = !culling || dx * dx + dz * dz <= cullDistanceSquared;
    }
  }

  private hideFallbackMeshes(): void {
    if (!this.fallbackMeshes) {
      return;
    }
    for (const mesh of this.fallbackMeshes) {
      mesh.visible = false;
    }
  }
}
