import { box, boxOnFloor, type VoxelModel } from '../voxel/Primitive';

/**
 * House —— 粗粒度建築。
 *
 * 座標原點在房屋中心、地面高度 y = 0。
 * 佔地約 30 × 22，牆體使用 4 單位等級的方塊，屋頂為階梯式。
 *
 * 尺度策略（PRD §7）：整體高約 31，明顯高於 Character（21.5），
 * 使 `House > Human` 在視覺上成立。門洞高 14 仍小於角色身高，
 * 角色不會實際走入，但 PRD §7 只要求視覺大小順序，未要求可進入。
 */
const WALL = 0xd8d2c8;
const FLOOR = 0x8d6e63;
const ROOF = 0xb03a2e;
const WOOD = 0x6d4c41;
const GLASS = 0x3b6ea5;
const STONE = 0x9e9e9e;

export function createHouseModel(): VoxelModel {
  const primitives = [
    // 地板
    boxOnFloor(0, 0, 0, 30, 1, 22, FLOOR),

    // 四面外牆（厚度 2.5）
    boxOnFloor(0, 1, -9.75, 30, 18, 2.5, WALL),
    boxOnFloor(-13.75, 1, 0, 2.5, 18, 22, WALL),
    boxOnFloor(13.75, 1, 0, 2.5, 18, 22, WALL),

    // 前牆留門洞（x: -4 ~ 4，高 14）
    boxOnFloor(-9.5, 1, 9.75, 11, 18, 2.5, WALL),
    boxOnFloor(9.5, 1, 9.75, 11, 18, 2.5, WALL),
    boxOnFloor(0, 15, 9.75, 8, 4, 2.5, WALL),

    // 門
    boxOnFloor(0, 1, 10.9, 8, 14, 0.8, WOOD),
    boxOnFloor(0, 7.5, 11.4, 0.8, 0.8, 0.5, 0xf1c40f), // 門把

    // 側牆窗戶
    box(-15.3, 10, -4, 0.8, 6, 6, GLASS),
    box(-15.3, 10, 4, 0.8, 6, 6, GLASS),
    box(15.3, 10, -4, 0.8, 6, 6, GLASS),
    box(15.3, 10, 4, 0.8, 6, 6, GLASS),

    // 台階
    boxOnFloor(0, 0, 12.75, 10, 1, 3.5, STONE),

    // 屋頂（階梯式金字塔，總高至 31）
    boxOnFloor(0, 19, 0, 33, 3, 25, ROOF),
    boxOnFloor(0, 22, 0, 26, 3, 18, ROOF),
    boxOnFloor(0, 25, 0, 19, 3, 11, ROOF),
    boxOnFloor(0, 28, 0, 12, 3, 4, ROOF),

    // 煙囪
    boxOnFloor(10, 19, -6, 2.5, 9, 2.5, 0x8d6e63),
    boxOnFloor(10, 28, -6, 4, 1, 4, STONE),
  ];

  return { primitives };
}
