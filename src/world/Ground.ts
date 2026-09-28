import * as THREE from 'three';

/** Ground —— 粗粒度的草原地面。 */
export function createGround(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(600, 600, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingSphere();

  const material = new THREE.MeshLambertMaterial({ color: 0x6ab04c });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Ground';
  return mesh;
}
