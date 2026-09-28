import * as THREE from 'three';

import { createAntLodModel, createAntModel } from '../objects/Ant';
import { createCharacterModel } from '../objects/Character';
import { createFlowerModel } from '../objects/Flower';
import { createHouseModel } from '../objects/House';
import { createTreeModel } from '../objects/Tree';
import { InstanceManager, type AntTransform } from '../rendering/InstanceManager';
import { buildVoxelGeometry, buildVoxelMesh, createVoxelMaterial } from '../voxel/MeshBuilder';
import type { VoxelModel } from '../voxel/Primitive';
import { createRng, range } from '../voxel/random';
import { createGround } from './Ground';

export const DEFAULT_FLOWER_COUNT = 50;
export const DEFAULT_ANT_COUNT = 100;
export const MAX_ANT_COUNT = 10_000;

/** 螞蟻活動範圍（半徑）與距離剔除門檻。 */
const ANT_FIELD_RADIUS = 100;
const CULL_DISTANCE = 90;
const LOD_DISTANCE = 40;
const TREE_COUNT = 3;

/**
 * World —— 只負責「場景內容」。
 * 資料流：VoxelModel → MeshBuilder → 少量 Mesh / InstancedMesh。
 * 不含 camera / renderer / 輸入。
 */
export class World {
  readonly material: THREE.MeshLambertMaterial;
  readonly ants: InstanceManager;

  private readonly scene: THREE.Scene;
  private readonly flowerGroup = new THREE.Group();
  private flowerMeshes: THREE.Mesh[] = [];
  private distanceCulling = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = createVoxelMaterial();

    scene.add(createGround());
    scene.add(this.flowerGroup);

    // 靜態物件
    this.addModel(scene, createHouseModel(), -22, -12, 0.4);
    this.addModel(scene, createCharacterModel(), 10, 6, -0.5);

    const treeRng = createRng(31337);
    for (let i = 0; i < TREE_COUNT; i += 1) {
      const angle = (i / TREE_COUNT) * Math.PI * 2;
      this.addModel(
        scene,
        createTreeModel(1000 + i),
        Math.cos(angle) * 34,
        Math.sin(angle) * 34,
        range(treeRng, 0, Math.PI * 2),
      );
    }

    this.setFlowerCount(DEFAULT_FLOWER_COUNT);

    // 螞蟻：變換預先算好，執行期只挑選要顯示的個體。
    const antRng = createRng(4242);
    const transforms: AntTransform[] = [];
    for (let i = 0; i < MAX_ANT_COUNT; i += 1) {
      const angle = range(antRng, 0, Math.PI * 2);
      const radius = Math.sqrt(antRng()) * ANT_FIELD_RADIUS;
      transforms.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        rotationY: range(antRng, 0, Math.PI * 2),
      });
    }

    this.ants = new InstanceManager(
      scene,
      buildVoxelGeometry(createAntModel()),
      buildVoxelGeometry(createAntLodModel()),
      this.material,
      transforms,
      { cullDistance: CULL_DISTANCE, lodDistance: LOD_DISTANCE },
    );
    this.ants.setCount(DEFAULT_ANT_COUNT);
  }

  setFlowerCount(count: number): void {
    const target = Math.max(0, Math.round(count));
    if (target === this.flowerMeshes.length) {
      return;
    }

    for (const mesh of this.flowerMeshes) {
      this.flowerGroup.remove(mesh);
      mesh.geometry.dispose();
    }
    this.flowerMeshes = [];

    const rng = createRng(9001);
    for (let i = 0; i < target; i += 1) {
      const angle = range(rng, 0, Math.PI * 2);
      const radius = range(rng, 8, 50);
      const mesh = buildVoxelMesh(createFlowerModel(5000 + i), this.material);
      mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      mesh.rotation.y = range(rng, 0, Math.PI * 2);
      mesh.name = `Flower_${i}`;
      this.flowerGroup.add(mesh);
      this.flowerMeshes.push(mesh);
    }
  }

  setDistanceCulling(enabled: boolean): void {
    this.distanceCulling = enabled;
    this.ants.setDistanceCulling(enabled);
  }

  /** 每帧呼叫。 */
  update(cameraPosition: THREE.Vector3): void {
    this.ants.update(cameraPosition);
    this.updateFlowerVisibility(cameraPosition);
  }

  setShadowsEnabled(enabled: boolean): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = enabled;
        object.receiveShadow = enabled;
      }
    });
  }

  private updateFlowerVisibility(cameraPosition: THREE.Vector3): void {
    const limit = CULL_DISTANCE * CULL_DISTANCE;
    for (const mesh of this.flowerMeshes) {
      mesh.visible =
        !this.distanceCulling || mesh.position.distanceToSquared(cameraPosition) <= limit;
    }
  }

  private addModel(
    scene: THREE.Scene,
    model: VoxelModel,
    x: number,
    z: number,
    rotationY: number,
  ): THREE.Mesh {
    const mesh = buildVoxelMesh(model, this.material);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rotationY;
    scene.add(mesh);
    return mesh;
  }
}
