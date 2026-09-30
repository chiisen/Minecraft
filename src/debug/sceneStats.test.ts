import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { countMeshes, countVertices } from './sceneStats';

/**
 * sceneStats 行為鎖定測試。
 *
 * 這裡刻意只用 Three.js 的核心物件（Scene / Mesh / InstancedMesh / Frustum），
 * 不建立 WebGLRenderer，因此可在純 Node 環境獨立執行，不需要瀏覽器或 WebGL context。
 * `countVertices` 必須與 `renderer.info.render.triangles` 同語意：
 * 只計入通過 frustum culling 的物件。
 */

/** 建立一台位於原點、朝 -Z 看、透視角 60 度的相機（Three.js 預設朝向即 -Z）。 */
function makeCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

/** box 幾何：24 個 position 頂點、36 個 index（= 12 三角形）。 */
function makeBox(): THREE.BoxGeometry {
  return new THREE.BoxGeometry(1, 1, 1);
}

function makeMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial();
}

describe('countMeshes', () => {
  it('遍歷場景只計入 Mesh / InstancedMesh，忽略 Points 等非 Mesh', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(makeBox(), makeMaterial()));
    group.add(new THREE.InstancedMesh(makeBox(), makeMaterial(), 2));
    group.add(new THREE.Points(makeBox(), new THREE.PointsMaterial()));
    scene.add(group);

    expect(countMeshes(scene)).toBe(2);
  });
});

describe('countVertices', () => {
  it('InstancedMesh 的頂點數需乘上實例數', () => {
    const camera = makeCamera();
    const scene = new THREE.Scene();
    const instanceCount = 5;
    const instanced = new THREE.InstancedMesh(makeBox(), makeMaterial(), instanceCount);
    instanced.position.set(0, 0, -10);
    scene.add(instanced);
    scene.updateMatrixWorld(true);

    expect(instanced.geometry.getAttribute('position').count).toBe(24);
    expect(countVertices(scene, camera)).toBe(24 * instanceCount);
  });

  it('畫面外物件不被計入（frustum culling 生效）', () => {
    const camera = makeCamera();
    const scene = new THREE.Scene();

    const inside = new THREE.Mesh(makeBox(), makeMaterial());
    inside.position.set(0, 0, -10);

    const outside = new THREE.Mesh(makeBox(), makeMaterial());
    outside.position.set(0, 0, 50);

    scene.add(inside, outside);
    scene.updateMatrixWorld(true);

    // 兩者都是 visible，但只有 inside 在視錐體內；countMeshes 不 cull，可證明是頂點判定過濾掉。
    expect(countMeshes(scene)).toBe(2);
    expect(countVertices(scene, camera)).toBe(24);
  });

  it('visible === false 的物件不被計入', () => {
    const camera = makeCamera();
    const scene = new THREE.Scene();
    const hidden = new THREE.Mesh(makeBox(), makeMaterial());
    hidden.position.set(0, 0, -10);
    hidden.visible = false;
    scene.add(hidden);
    scene.updateMatrixWorld(true);

    expect(countVertices(scene, camera)).toBe(0);
  });

  it('Vertices : Triangles = 2:1 自洽（box 24 頂點 / 12 三角形）', () => {
    const camera = makeCamera();
    const scene = new THREE.Scene();
    const box = new THREE.Mesh(makeBox(), makeMaterial());
    box.position.set(0, 0, -10);
    scene.add(box);
    scene.updateMatrixWorld(true);

    const vertices = countVertices(scene, camera);
    const triangles = (box.geometry.index?.count ?? 0) / 3;

    expect(triangles).toBe(12);
    expect(vertices).toBe(24);
    expect(vertices / triangles).toBe(2);
  });

  it('可在不依賴瀏覽器 / WebGL context 的環境獨立執行', () => {
    expect(typeof WebGLRenderingContext).toBe('undefined');

    const camera = makeCamera();
    const scene = new THREE.Scene();
    const box = new THREE.Mesh(makeBox(), makeMaterial());
    box.position.set(0, 0, -10);
    scene.add(box);
    scene.updateMatrixWorld(true);

    expect(countVertices(scene, camera)).toBe(24);
  });
});
