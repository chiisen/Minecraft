import { box, boxOnFloor, type Primitive, type VoxelModel } from '../voxel/Primitive';

/**
 * Ant —— 最小粒度生物（僅用 1 單位等級的方塊）。
 * 座標原點在身體中心、地面高度 y = 0，體長約 3.6 單位。
 *
 * 螞蟻是效能壓力測試的主角，因此只有「一個共用 Geometry」，
 * 大量個體以同一個 Geometry + Material 重複使用。
 */

const BODY = 0x2b1d16;
const BODY_DARK = 0x1d130d;

export function createAntModel(): VoxelModel {
  const primitives: Primitive[] = [
    // 三節身體（腹部 / 胸 / 頭）
    boxOnFloor(-1.3, 0.15, 0, 1.3, 1.3, 1.3, BODY),
    boxOnFloor(0, 0.25, 0, 1, 1, 1, BODY_DARK),
    boxOnFloor(1.1, 0.2, 0, 1.1, 1.1, 1.1, BODY),
    // 眼睛
    box(1.4, 1, 0.35, 0.3, 0.3, 0.3, 0x111111),
    box(1.4, 1, -0.35, 0.3, 0.3, 0.3, 0x111111),
    // 觸角
    box(1.9, 1.6, 0.3, 0.9, 0.25, 0.25, BODY_DARK),
    box(1.9, 1.6, -0.3, 0.9, 0.25, 0.25, BODY_DARK),
  ];

  // 六條腿
  for (const legX of [-0.6, 0, 0.6]) {
    primitives.push(
      boxOnFloor(legX, 0, 0.75, 0.3, 0.9, 0.9, BODY_DARK),
      boxOnFloor(legX, 0, -0.75, 0.3, 0.9, 0.9, BODY_DARK),
    );
  }

  return { primitives };
}

/**
 * Ant 的 LOD1 簡化版：只留三節身體。
 * 距離較遠、細節看不見時改用它，大幅降低三角形數量。
 */
export function createAntLodModel(): VoxelModel {
  const primitives: Primitive[] = [
    boxOnFloor(-1.3, 0.15, 0, 1.3, 1.3, 1.3, BODY),
    boxOnFloor(0, 0.25, 0, 1, 1, 1, BODY_DARK),
    boxOnFloor(1.1, 0.2, 0, 1.1, 1.1, 1.1, BODY),
  ];

  return { primitives };
}
