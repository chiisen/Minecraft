import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { Primitive, VoxelModel } from './Primitive';

/**
 * 唯一接觸 Three.js Geometry 的地方。
 *
 * Rule 1：一個 VoxelModel 只產生「一個」BufferGeometry，
 * 而不是每個 voxel 一個 Mesh。顏色寫進 vertex color，讓所有模型共用材質。
 */

export function createVoxelMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true });
}

export function buildVoxelGeometry(model: VoxelModel): THREE.BufferGeometry {
  const geometries = model.primitives.map(toBoxGeometry);
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) {
    geometry.dispose();
  }
  if (!merged) {
    throw new Error('Failed to merge voxel geometry');
  }
  merged.computeBoundingSphere();
  return merged;
}

export function buildVoxelMesh(model: VoxelModel, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(buildVoxelGeometry(model), material);
}

function toBoxGeometry(primitive: Primitive): THREE.BufferGeometry {
  const { position, size, color } = primitive;
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  geometry.translate(position.x, position.y, position.z);

  const vertexCount = geometry.attributes.position.count;
  const colors = new Float32Array(vertexCount * 3);
  const tint = new THREE.Color(color);
  for (let i = 0; i < vertexCount; i += 1) {
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}
