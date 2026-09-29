import * as THREE from 'three';

/**
 * 場景統計：Debug UI 與自動化 benchmark 共用。
 *
 * 集中在這裡是因為 `renderer.info` 只提供 calls / triangles / points / lines，
 * 沒有「物件數」與「頂點數」；兩者都要自己從場景遍歷取得。
 * 之前 Game 與 PerformanceMonitor 各有一份物件計數，合併後避免再分岔。
 */

/** 場景中的 Mesh / InstancedMesh 總數（InstancedMesh 繼承自 Mesh，一併計入）。 */
export function countMeshes(scene: THREE.Scene): number {
  let count = 0;
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      count += 1;
    }
  });
  return count;
}

/**
 * 本幀實際送入 GPU 的頂點數（PRD §15 要求記錄 Vertices）。
 *
 * 與 `renderer.info.render.triangles` 保持同一語意：只計入**通過 frustum culling** 的
 * 物件，否則 non-instanced 模式會把畫面外那幾百隻螞蟻也算進來，數字會遠大於實際負載。
 * InstancedMesh 的頂點數乘上實例數；LOD 換模型後自然反映當前模型。
 */
export function countVertices(scene: THREE.Scene, camera: THREE.Camera): number {
  const frustum = new THREE.Frustum();
  const viewProjection = new THREE.Matrix4();
  viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(viewProjection);

  let total = 0;
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.visible) {
      return;
    }
    // 整批 InstancedMesh 以它的 boundingSphere 判定；部分可見時整批頂點都算。
    if (!frustum.intersectsObject(object)) {
      return;
    }
    const position = object.geometry.getAttribute('position');
    if (position === undefined) {
      return;
    }
    const instances = object instanceof THREE.InstancedMesh ? object.count : 1;
    total += position.count * instances;
  });
  return total;
}
