import { box, boxOnFloor, type Primitive, type VoxelModel } from '../voxel/Primitive';

/**
 * Character —— 細粒度人物（核心 Prototype）。
 *
 * 刻意「不使用」Minecraft 式的 6 個大立方體，而是由約 30 個小 Primitive 組成：
 * 頭部有髮型、耳朵、鼻子、嘴巴與眼睛，臉不是單一巨大方塊。
 *
 * 座標原點在雙腳之間、地面高度 y = 0，身高約 21 單位。
 */

const SKIN = 0xe8b48f;
const SKIN_DARK = 0xdca078;
const SHIRT = 0xc0392b;
const PANTS = 0x34495e;
const SHOE = 0x1f2d3d;
const HAIR = 0x2c2c34;
const BELT = 0x2c3e50;
const EYE = 0x1b1b1f;
const MOUTH = 0x8e4b3a;

const LEG_HEIGHT = 7;
const TORSO_HEIGHT = 6;
const TORSO_TOP = LEG_HEIGHT + TORSO_HEIGHT;

export function createCharacterModel(): VoxelModel {
  const primitives: Primitive[] = [];

  addLegs(primitives);
  addTorso(primitives);
  addArms(primitives);
  addHead(primitives);

  return { primitives };
}

function addLegs(target: Primitive[]): void {
  target.push(
    boxOnFloor(-1.5, 0, 0, 2, LEG_HEIGHT, 2, PANTS),
    boxOnFloor(1.5, 0, 0, 2, LEG_HEIGHT, 2, PANTS),
    // 鞋子（往前突出）
    boxOnFloor(-1.5, 0, 0.5, 2, 1, 3, SHOE),
    boxOnFloor(1.5, 0, 0.5, 2, 1, 3, SHOE),
  );
}

function addTorso(target: Primitive[]): void {
  target.push(
    boxOnFloor(0, LEG_HEIGHT, 0, 5, TORSO_HEIGHT, 3, SHIRT),
    box(0, LEG_HEIGHT + 0.5, 0, 5.2, 1, 3.2, BELT),
  );
}

function addArms(target: Primitive[]): void {
  const armX = 3.25;
  target.push(
    // 袖子
    boxOnFloor(-armX, TORSO_TOP - 3, 0, 1.5, 3, 2, SHIRT),
    boxOnFloor(armX, TORSO_TOP - 3, 0, 1.5, 3, 2, SHIRT),
    // 前臂
    boxOnFloor(-armX, TORSO_TOP - 6, 0, 1.5, 3, 2, SKIN),
    boxOnFloor(armX, TORSO_TOP - 6, 0, 1.5, 3, 2, SKIN),
  );
}

function addHead(target: Primitive[]): void {
  const headBottom = TORSO_TOP + 1;
  const headHeight = 6;

  target.push(
    // 脖子
    boxOnFloor(0, TORSO_TOP, 0, 1.6, 1, 1.6, SKIN_DARK),
    // 頭部主體
    boxOnFloor(0, headBottom, 0, 5, headHeight, 5, SKIN),
    // 耳朵
    box(-2.6, headBottom + 3.2, 0, 0.5, 1.5, 1.5, SKIN_DARK),
    box(2.6, headBottom + 3.2, 0, 0.5, 1.5, 1.5, SKIN_DARK),
  );

  addFace(target, headBottom);
  addHair(target, headBottom, headHeight);
}

function addFace(target: Primitive[], headBottom: number): void {
  const faceZ = 2.5;

  // 眼白 + 瞳孔
  for (const x of [-1.2, 1.2]) {
    target.push(
      box(x, headBottom + 3.5, faceZ + 0.05, 1.2, 1.2, 0.2, 0xffffff),
      box(x, headBottom + 3.5, faceZ + 0.2, 0.7, 0.7, 0.2, EYE),
      // 眉毛
      box(x, headBottom + 4.6, faceZ + 0.1, 1.2, 0.3, 0.4, HAIR),
    );
  }

  target.push(
    // 鼻子
    box(0, headBottom + 2.8, faceZ + 0.4, 0.8, 1, 0.8, SKIN_DARK),
    // 嘴巴
    box(0, headBottom + 1.3, faceZ + 0.1, 1.6, 0.4, 0.4, MOUTH),
  );
}

function addHair(target: Primitive[], headBottom: number, headHeight: number): void {
  const top = headBottom + headHeight;
  target.push(
    // 頭頂
    boxOnFloor(0, top, 0, 5.4, 1.5, 5.4, HAIR),
    // 後腦
    box(0, headBottom + 3, -2.7, 5.4, 4, 0.6, HAIR),
    // 兩側
    box(-2.7, headBottom + 3, 0, 0.6, 4, 5.4, HAIR),
    box(2.7, headBottom + 3, 0, 0.6, 4, 5.4, HAIR),
    // 額前瀏海
    box(0, headBottom + 5.4, 2.7, 5.4, 1.6, 0.6, HAIR),
  );
}
