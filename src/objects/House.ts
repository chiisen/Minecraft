import { box, boxOnFloor, type VoxelModel } from '../voxel/Primitive';

/**
 * House —— 粗粒度建築。
 *
 * 座標原點在房屋中心、地面高度 y = 0。
 * 佔地約 24 × 18，牆體使用 4 單位等級的方塊，屋頂為階梯式。
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
    boxOnFloor(0, 0, 0, 24, 1, 18, FLOOR),

    // 四面外牆（厚度 2）
    boxOnFloor(0, 1, -8, 24, 12, 2, WALL),
    boxOnFloor(-11, 1, 0, 2, 12, 18, WALL),
    boxOnFloor(11, 1, 0, 2, 12, 18, WALL),

    // 前牆留門洞（x: -3 ~ 3，高 8）
    boxOnFloor(-7.5, 1, 8, 9, 12, 2, WALL),
    boxOnFloor(7.5, 1, 8, 9, 12, 2, WALL),
    boxOnFloor(0, 9, 8, 6, 4, 2, WALL),

    // 門
    boxOnFloor(0, 1, 9.1, 6, 8, 0.6, WOOD),
    boxOnFloor(0, 5, 9.5, 0.6, 0.6, 0.4, 0xf1c40f), // 門把

    // 側牆窗戶
    box(-12.3, 7, -4, 0.6, 4, 4, GLASS),
    box(-12.3, 7, 4, 0.6, 4, 4, GLASS),
    box(12.3, 7, -4, 0.6, 4, 4, GLASS),
    box(12.3, 7, 4, 0.6, 4, 4, GLASS),

    // 台階
    boxOnFloor(0, 0, 10.5, 8, 1, 3, STONE),

    // 屋頂（階梯式金字塔）
    boxOnFloor(0, 13, 0, 26, 2, 20, ROOF),
    boxOnFloor(0, 15, 0, 20, 2, 14, ROOF),
    boxOnFloor(0, 17, 0, 14, 2, 8, ROOF),
    boxOnFloor(0, 19, 0, 8, 2, 2, ROOF),

    // 煙囪
    boxOnFloor(8, 13, -5, 2, 7, 2, 0x8d6e63),
    boxOnFloor(8, 20, -5, 3, 1, 3, STONE),
  ];

  return { primitives };
}
