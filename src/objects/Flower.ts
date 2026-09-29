import { box, boxOnFloor, type Primitive, type VoxelModel } from '../voxel/Primitive';
import { createRng, pick, range } from '../voxel/random';

/**
 * Flower —— 細粒度（全部 1 單位方塊）。
 * 座標原點在花莖中心、地面高度 y = 0，高度約 5 單位。
 */

const STEM = 0x2e8b57;
const PETAL_COLORS = [0xff6b81, 0xffd166, 0xf368e0, 0xffffff, 0xff9f43] as const;

/** 一朵花的「變體」：外觀相同的花可共用同一份幾何與 InstancedMesh。 */
export interface FlowerVariant {
  /** 外觀鍵；只要外觀不同就必須有不同的鍵。 */
  readonly key: string;
  readonly model: VoxelModel;
}

export function createFlowerVariant(seed: number): FlowerVariant {
  const rng = createRng(seed);
  const stemHeight = Math.round(range(rng, 3, 5));
  const top = stemHeight;

  const primitives: Primitive[] = [
    boxOnFloor(0, 0, 0, 1, stemHeight, 1, STEM),
    // 葉子
    box(1, stemHeight * 0.5, 0, 1, 1, 1, STEM),
    // 花蕊
    box(0, top + 0.5, 0, 1, 1, 1, 0xf1c40f),
  ];

  // 十字排列的花瓣
  const petal = pick(rng, PETAL_COLORS);
  primitives.push(
    box(0, top + 0.5, 1, 1, 1, 1, petal),
    box(0, top + 0.5, -1, 1, 1, 1, petal),
    box(1, top + 0.5, 0, 1, 1, 1, petal),
    box(-1, top + 0.5, 0, 1, 1, 1, petal),
  );

  return { key: `${stemHeight}:${petal}`, model: { primitives } };
}

export function createFlowerModel(seed: number): VoxelModel {
  return createFlowerVariant(seed).model;
}
