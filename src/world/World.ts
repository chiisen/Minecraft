import * as THREE from 'three';

import { createAntLodModel, createAntModel } from '../objects/Ant';
import { createCharacterModel, createCoarseCharacterModel } from '../objects/Character';
import { createHouseModel } from '../objects/House';
import { createTreeModel } from '../objects/Tree';
import { FlowerField } from '../rendering/FlowerField';
import { InstanceManager, type AntTransform } from '../rendering/InstanceManager';
import { buildVoxelGeometry, buildVoxelMesh, createVoxelMaterial } from '../voxel/MeshBuilder';
import type { VoxelModel } from '../voxel/Primitive';
import { createRng, range } from '../voxel/random';
import { createGround } from './Ground';
import {
  CHARACTER_POSITION,
  COARSE_CHARACTER_POSITION,
  HOUSE_POSITION,
  sampleOpenDisk,
  treePositions,
} from './placement';

export const DEFAULT_FLOWER_COUNT = 50;
export const DEFAULT_ANT_COUNT = 100;
export const MAX_ANT_COUNT = 10_000;

/**
 * 螞蟻活動範圍（半徑）與距離剔除門檻。
 * 半徑由 100 加大到 140：10,000 隻的平均間距從 1.77 提升到 2.48 單位，
 * 近距離不再糊成一團（issue #14）。剔除距離隨之調整，仍保留剔除效果。
 */
const ANT_FIELD_RADIUS = 140;
const CULL_DISTANCE = 130;
const LOD_DISTANCE = 40;

/** 螞蟻與建築之間的額外淨空，避免貼著牆面生長。 */
const ANT_CLEARANCE = 0.6;

/**
 * World —— 只負責「場景內容」。
 * 資料流：VoxelModel → MeshBuilder → 少量 Mesh / InstancedMesh。
 * 不含 camera / renderer / 輸入。
 */
export class World {
  readonly material: THREE.MeshLambertMaterial;
  readonly ants: InstanceManager;

  private readonly scene: THREE.Scene;
  private readonly flowers: FlowerField;
  private readonly coarseCharacter: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = createVoxelMaterial();

    scene.add(createGround());
    this.flowers = new FlowerField(scene, this.material);

    // 靜態物件
    this.addModel(scene, createHouseModel(), HOUSE_POSITION.x, HOUSE_POSITION.z, 0.4);
    this.addModel(
      scene,
      createCharacterModel(),
      CHARACTER_POSITION.x,
      CHARACTER_POSITION.z,
      -0.5,
    );

    // Phase 3 A/B 對照組：預設隱藏，由 Debug UI / 除錯 API 切換。
    this.coarseCharacter = this.addModel(
      scene,
      createCoarseCharacterModel(),
      COARSE_CHARACTER_POSITION.x,
      COARSE_CHARACTER_POSITION.z,
      -0.5,
    );
    this.coarseCharacter.visible = false;

    const treeRng = createRng(31337);
    for (const [index, position] of treePositions().entries()) {
      this.addModel(
        scene,
        createTreeModel(1000 + index),
        position.x,
        position.z,
        range(treeRng, 0, Math.PI * 2),
      );
    }

    this.setFlowerCount(DEFAULT_FLOWER_COUNT);

    // 螞蟻：變換預先算好，執行期只挑選要顯示的個體。
    const antRng = createRng(4242);
    const transforms: AntTransform[] = [];
    for (let i = 0; i < MAX_ANT_COUNT; i += 1) {
      const { x, z } = sampleOpenDisk(antRng, ANT_FIELD_RADIUS, ANT_CLEARANCE);
      transforms.push({ x, z, rotationY: range(antRng, 0, Math.PI * 2) });
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
    this.flowers.setCount(count);
  }

  setDistanceCulling(enabled: boolean): void {
    // 花已改為 InstancedMesh（每個變體一個 draw call），無法逐朵距離剔除；
    // 花朵總數上限 200、三角形成本極低，因此只對螞蟻套用距離剔除。
    this.ants.setDistanceCulling(enabled);
  }

  /** Phase 3：切換 Minecraft-like 粗方塊對照角色。 */
  setCoarseCharacterVisible(visible: boolean): void {
    this.coarseCharacter.visible = visible;
  }

  /** 每帧呼叫。 */
  update(cameraPosition: THREE.Vector3): void {
    this.ants.update(cameraPosition);
  }

  setShadowsEnabled(enabled: boolean): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = enabled;
        object.receiveShadow = enabled;
      }
    });
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
