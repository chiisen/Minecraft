import { box, boxOnFloor, type Primitive, type VoxelModel } from '../voxel/Primitive';
import { createRng, pick, range, type Rng } from '../voxel/random';

/**
 * Tree —— 混合尺度：樹幹（4）、枝幹（2）、樹葉（1）。
 * 座標原點在樹幹中心、地面高度 y = 0。
 */

const TRUNK = 0x6d4c41;
const LEAF_COLORS = [0x3f8f4a, 0x4aa356, 0x357a41, 0x5cb85c] as const;

export function createTreeModel(seed: number): VoxelModel {
  const rng = createRng(seed);
  const trunkHeight = Math.round(range(rng, 14, 20));

  const primitives: Primitive[] = [
    boxOnFloor(0, 0, 0, 4, trunkHeight, 4, TRUNK),
    // 枝幹
    box(3, trunkHeight - 3, 0, 3, 2, 2, TRUNK),
    box(-3, trunkHeight - 5, 1, 3, 2, 2, TRUNK),
  ];

  addCanopy(primitives, rng, trunkHeight + 3);
  return { primitives };
}

function addCanopy(target: Primitive[], rng: Rng, centerY: number): void {
  const radius = 8;
  for (let i = 0; i < 46; i += 1) {
    const x = range(rng, -radius, radius);
    const y = centerY + range(rng, -radius * 0.8, radius * 0.9);
    const z = range(rng, -radius, radius);
    if (Math.hypot(x, y - centerY, z) > radius) {
      continue;
    }
    const size = pick(rng, [1, 1, 2] as const);
    target.push(box(x, y, z, size, size, size, pick(rng, LEAF_COLORS)));
  }
}
