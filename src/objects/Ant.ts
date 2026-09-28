import { box, boxOnFloor, type Primitive, type VoxelModel } from '../voxel/Primitive';

/**
 * Ant —— 最小粒度生物（僅用 1 單位等級的方塊）。
 * 座標原點在身體中心、地面高度 y = 0，含觸角的體長約 4.6 單位。
 *
 * 螞蟻是效能壓力測試的主角，因此只有「一個共用 Geometry」，
 * 大量個體以同一個 Geometry + Material 重複使用。
 */

/**
 * 體色刻意比真實螞蟻亮：Phase 1 驗證（#3）指出原本的 0x2b1d16 在草地上過暗，
 * 近看時方塊界線融成一片。改用暖棕 + 深棕的明暗對比，讓頭 / 胸 / 腹 / 腳可分辨。
 */
const BODY = 0x8f5a2e;
const BODY_DARK = 0x50331b;

/**
 * 三節身體（腹部 / 胸腰部 / 頭）。
 * 中段刻意比腹部／頭部細且抬高，做出螞蟻特有的「腰身」，
 * 否則三節會糊成一坨，近看像一隻長角的怪獸而不是螞蟻。
 */
const BODY_SEGMENTS: readonly (readonly [number, number, number, number, number])[] = [
  // [中心 x, 底面 y, 寬, 高, 深]
  [-1.35, 0.1, 1.5, 1.5, 1.5], // 腹部：最大
  [0.05, 0.55, 1.3, 0.7, 0.7], // 胸腰：最細、抬高 → 腰身
  [1.2, 0.3, 1.3, 1.3, 1.3], // 頭部
];

export function createAntModel(): VoxelModel {
  const primitives: Primitive[] = BODY_SEGMENTS.map(([x, floorY, width, height, depth], index) =>
    boxOnFloor(x, floorY, 0, width, height, depth, index === 1 ? BODY_DARK : BODY),
  );

  primitives.push(
    // 眼睛：長在頭部兩側並略微突出，否則會被頭部方塊完全包住而看不見。
    box(1.55, 0.95, 0.72, 0.3, 0.3, 0.3, 0x0d0d0d),
    box(1.55, 0.95, -0.72, 0.3, 0.3, 0.3, 0x0d0d0d),
    // 觸角：細長方塊，向前伸出後在末端微微上折（真實螞蟻觸角的輪廓）。
    // 太粗會看起來像犄角，因此截面只有 0.16。
    ...[-0.32, 0.32].flatMap((z): Primitive[] => [
      box(2.15, 1.45, z, 0.7, 0.16, 0.16, BODY_DARK),
      box(2.42, 1.72, z, 0.16, 0.42, 0.16, BODY_DARK),
    ]),
  );

  // 六條腿
  for (const legX of [-0.7, 0.05, 0.75]) {
    primitives.push(
      boxOnFloor(legX, 0, 0.7, 0.3, 0.9, 0.9, BODY_DARK),
      boxOnFloor(legX, 0, -0.7, 0.3, 0.9, 0.9, BODY_DARK),
    );
  }

  return { primitives };
}

/**
 * Ant 的 LOD1 簡化版：只留三節身體。
 * 距離較遠、細節看不見時改用它，大幅降低三角形數量。
 */
export function createAntLodModel(): VoxelModel {
  const primitives: Primitive[] = BODY_SEGMENTS.map(
    ([x, floorY, width, height, depth], index) =>
      boxOnFloor(x, floorY, 0, width, height, depth, index === 1 ? BODY_DARK : BODY),
  );

  return { primitives };
}
