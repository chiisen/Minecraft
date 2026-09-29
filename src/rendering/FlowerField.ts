import * as THREE from 'three';

import { createFlowerVariant } from '../objects/Flower';
import { buildVoxelGeometry } from '../voxel/MeshBuilder';
import type { VoxelModel } from '../voxel/Primitive';
import { createRng, range } from '../voxel/random';
import { sampleOpenRing } from '../world/placement';

/**
 * FlowerField —— 花卉群（PRD §11.3：大量相同物件優先使用 InstancedMesh）。
 *
 * 每朵花的外觀由「花莖高度 × 花瓣顏色」決定，只有有限幾種變體。
 * 依變體分桶，每個變體一個 InstancedMesh，因此 draw call 數與花朵數量脫鉤，
 * 只跟「變體數」有關（最多 3 × 5 = 15）。
 *
 * 與 Ant 的差異：花是靜態的，不需要每帧更新矩陣，所以只在數量變動時重建。
 */

/** 花卉分佈：半徑 8 ~ 50 的圓環，並與建築保持淨空。 */
const RING_INNER = 8;
const RING_OUTER = 50;
const FLOWER_CLEARANCE = 2.5;

/** 固定種子，讓同一個 flowerCount 每次都產生相同分佈。 */
const PLACEMENT_SEED = 9001;
const MODEL_SEED_BASE = 5000;

interface FlowerInstance {
  readonly x: number;
  readonly z: number;
  readonly rotationY: number;
}

export class FlowerField {
  private readonly group = new THREE.Group();
  private readonly material: THREE.Material;
  private meshes: THREE.InstancedMesh[] = [];
  private count = 0;

  constructor(scene: THREE.Scene, material: THREE.Material) {
    this.material = material;
    scene.add(this.group);
  }

  setCount(count: number): void {
    const target = Math.max(0, Math.round(count));
    if (target === this.count) {
      return;
    }
    this.count = target;
    this.rebuild();
  }

  /** 場景中的花朵變體數（供驗證 / 除錯參考）。 */
  get variantCount(): number {
    return this.meshes.length;
  }

  private rebuild(): void {
    this.disposeMeshes();

    const buckets = new Map<string, { model: VoxelModel; instances: FlowerInstance[] }>();
    const rng = createRng(PLACEMENT_SEED);

    for (let i = 0; i < this.count; i += 1) {
      const { x, z } = sampleOpenRing(rng, RING_INNER, RING_OUTER, FLOWER_CLEARANCE);
      const rotationY = range(rng, 0, Math.PI * 2);
      const { key, model } = createFlowerVariant(MODEL_SEED_BASE + i);

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { model, instances: [] };
        buckets.set(key, bucket);
      }
      bucket.instances.push({ x, z, rotationY });
    }

    const matrix = new THREE.Matrix4();
    for (const { model, instances } of buckets.values()) {
      const mesh = new THREE.InstancedMesh(
        buildVoxelGeometry(model),
        this.material,
        instances.length,
      );
      mesh.name = 'Flowers';
      instances.forEach((instance, index) => {
        matrix.makeRotationY(instance.rotationY);
        matrix.setPosition(instance.x, 0, instance.z);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
      this.meshes.push(mesh);
    }
  }

  private disposeMeshes(): void {
    for (const mesh of this.meshes) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.meshes = [];
  }
}
