import { box, boxOnFloor, type Primitive, type VoxelModel } from '../voxel/Primitive';
import { createRng, pick, range, type Rng } from '../voxel/random';

/**
 * Tree —— 混合尺度：樹幹（4）、枝幹（2.5）、樹葉（2.1~2.6）。
 * 座標原點在樹幹中心、地面高度 y = 0。
 */

const TRUNK = 0x6d4c41;
const LEAF_COLORS = [0x3f8f4a, 0x4aa356, 0x357a41, 0x5cb85c] as const;

/** 樹冠的體素格距與半徑。 */
const LEAF_STEP = 2;
const CANOPY_RADIUS = 7.5;

export function createTreeModel(seed: number): VoxelModel {
  const rng = createRng(seed);
  const trunkHeight = Math.round(range(rng, 14, 20));

  const primitives: Primitive[] = [
    boxOnFloor(0, 0, 0, 4, trunkHeight, 4, TRUNK),
    // 枝幹：從樹幹上段往外伸出，大多埋在樹冠下緣，只露出末端。
    box(3, trunkHeight - 4, 0, 8, 2.5, 2.5, TRUNK),
    box(-3, trunkHeight - 5, 2, 8, 2.5, 2.5, TRUNK),
    box(0, trunkHeight - 5, -3, 2.5, 2.5, 8, TRUNK),
  ];

  // 樹冠中心略高於樹幹頂端，讓底部與樹幹、枝幹確實重疊。
  addCanopy(primitives, rng, trunkHeight + 1);
  return { primitives };
}

/**
 * 用體素格點填滿球體，而不是隨機撒點。
 *
 * Phase 1 驗證（#3）發現隨機撒點會讓葉片彼此不相連，看起來是一堆懸空方塊；
 * 格點填滿能保證樹冠是「一整團」，再用隨機半徑收斂出不規則輪廓。
 *
 * 兩個關鍵細節：
 * - 葉片尺寸一律 ≥ 格距，相鄰葉片必定互相接觸，不會出現細縫。
 * - 不做「隨機挖空」，避免產生孤立的懸浮葉片。輪廓的不規則感完全交給隨機半徑。
 */
function addCanopy(target: Primitive[], rng: Rng, centerY: number): void {
  const steps = Math.floor(CANOPY_RADIUS / LEAF_STEP);
  for (let ix = -steps; ix <= steps; ix += 1) {
    for (let iy = -steps; iy <= steps; iy += 1) {
      for (let iz = -steps; iz <= steps; iz += 1) {
        const x = ix * LEAF_STEP;
        const y = iy * LEAF_STEP;
        const z = iz * LEAF_STEP;
        const distance = Math.hypot(x, y, z);
        if (distance > CANOPY_RADIUS) {
          continue;
        }
        // 邊緣用隨機半徑收斂，避免死板的完美球體。
        if (distance > CANOPY_RADIUS * (0.82 + rng() * 0.18)) {
          continue;
        }
        const size = LEAF_STEP * (1.05 + rng() * 0.25);
        target.push(box(x, centerY + y, z, size, size, size, pick(rng, LEAF_COLORS)));
      }
    }
  }
}
