import * as THREE from 'three';

import { createAntModel } from '../objects/Ant';
import { createCharacterModel } from '../objects/Character';
import { createFlowerModel } from '../objects/Flower';
import { createHouseModel } from '../objects/House';
import { createTreeModel } from '../objects/Tree';
import { buildVoxelGeometry, buildVoxelMesh, createVoxelMaterial } from '../voxel/MeshBuilder';
import type { VoxelModel } from '../voxel/Primitive';
import { createRng, range } from '../voxel/random';
import { createGround } from './Ground';

/** Phase 1 的固定數量（Phase 2 才會由 lil-gui 控制）。 */
export const FLOWER_COUNT = 50;
export const TREE_COUNT = 3;
export const ANT_COUNT = 20;

export interface WorldHandles {
  readonly antGeometry: THREE.BufferGeometry;
}

/**
 * 建立整個 Playground。
 * 資料流：VoxelModel → MeshBuilder → 少量 Mesh / InstancedMesh（Phase 2）。
 */
export function buildWorld(scene: THREE.Scene): WorldHandles {
  const material = createVoxelMaterial();
  const rng = createRng(20260928);

  scene.add(createGround());

  // 建築與人物放在同一區，方便直接比較尺度。
  addModel(scene, createHouseModel(), material, -22, -12, 0.4);
  addModel(scene, createCharacterModel(), material, 10, 6, -0.5);

  for (let i = 0; i < TREE_COUNT; i += 1) {
    const angle = (i / TREE_COUNT) * Math.PI * 2;
    addModel(
      scene,
      createTreeModel(1000 + i),
      material,
      Math.cos(angle) * 34,
      Math.sin(angle) * 34,
      range(rng, 0, Math.PI * 2),
    );
  }

  for (let i = 0; i < FLOWER_COUNT; i += 1) {
    const angle = range(rng, 0, Math.PI * 2);
    const radius = range(rng, 6, 42);
    addModel(
      scene,
      createFlowerModel(5000 + i),
      material,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      range(rng, 0, Math.PI * 2),
    );
  }

  // 螞蟻共用同一個 Geometry，避免重複上傳 GPU。
  const antGeometry = buildVoxelGeometry(createAntModel());
  for (let i = 0; i < ANT_COUNT; i += 1) {
    const ant = new THREE.Mesh(antGeometry, material);
    const angle = range(rng, 0, Math.PI * 2);
    const radius = range(rng, 4, 20);
    ant.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    ant.rotation.y = range(rng, 0, Math.PI * 2);
    ant.name = `Ant_${i}`;
    scene.add(ant);
  }

  return { antGeometry };
}

function addModel(
  scene: THREE.Scene,
  model: VoxelModel,
  material: THREE.Material,
  x: number,
  z: number,
  rotationY: number,
): THREE.Mesh {
  const mesh = buildVoxelMesh(model, material);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rotationY;
  scene.add(mesh);
  return mesh;
}
