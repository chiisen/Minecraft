/**
 * 純資料層：描述 Voxel / Primitive 的形狀與顏色。
 *
 * 這一層不得依賴 Three.js，也不代表任何 GPU Object。
 * 一個 VoxelModel 之後會被 MeshBuilder 合併成「單一」Geometry。
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Primitive {
  /** 方塊中心點（模型區域座標）。 */
  readonly position: Vec3;
  /** 方塊尺寸（寬、高、深），單位為世界單位。 */
  readonly size: Vec3;
  /** 十六進位顏色，例如 0xc0392b。 */
  readonly color: number;
}

export interface VoxelModel {
  readonly primitives: readonly Primitive[];
}

/** 以「中心點」建立一個方塊。 */
export function box(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  color: number,
): Primitive {
  return {
    position: { x, y, z },
    size: { x: width, y: height, z: depth },
    color,
  };
}

/** 以「底面高度」建立一個方塊，方便讓物件站在地面上。 */
export function boxOnFloor(
  x: number,
  floorY: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  color: number,
): Primitive {
  return box(x, floorY + height / 2, z, width, height, depth, color);
}
