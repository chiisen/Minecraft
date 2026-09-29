import { range, type Rng } from '../voxel/random';

/**
 * 場景擺放的共用資料與「排除區域」邏輯。
 *
 * PRD 明確排除 Physics Engine，所以這裡不做碰撞，只保證「靜態擺放不穿模」：
 * 花與螞蟻取樣時避開建築佔地，必要時重試。
 * 靜態物件位置與排除區域放在同一處，避免兩邊各寫一份而走鐘。
 */

/** 地面上不可被花 / 螞蟻佔用的區域（軸對齊矩形）。 */
export interface GroundZone {
  readonly x: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfZ: number;
}

export const HOUSE_POSITION = { x: -22, z: -12 } as const;
export const CHARACTER_POSITION = { x: 10, z: 6 } as const;
/**
 * Phase 3 A/B 對照用的 Minecraft-like 粗方塊角色，站在細尺度角色左側。
 * 預設隱藏（Debug UI 的 Coarse Character 開關），但位置固定，
 * 因此排除區域照樣保留，讓花 / 螞蟻的分佈不因開關而變動。
 */
export const COARSE_CHARACTER_POSITION = { x: 1, z: 6 } as const;

export const TREE_COUNT = 3;
/**
 * 樹木距原點的距離。
 * 34 時 Tree#1 的樹冠邊緣 (z = -22.1) 幾乎貼上 House 屋簷 (z = -22)，
 * 雖然實測沒有真正相交，但視覺上像穿模；改為 38 留出明確淨空。
 */
export const TREE_RADIUS = 38;

/** 三棵樹均分在同一圓周上。 */
export function treePositions(): readonly { readonly x: number; readonly z: number }[] {
  return Array.from({ length: TREE_COUNT }, (_, index) => {
    const angle = (index / TREE_COUNT) * Math.PI * 2;
    return { x: Math.cos(angle) * TREE_RADIUS, z: Math.sin(angle) * TREE_RADIUS };
  });
}

/**
 * 排除區域。半寬已含物件實際佔地：
 * House 含屋簷（±13 / ±10）與台階（+z 至 0）、Tree 含樹冠（半徑 7.2）、
 * Character 含手臂與鞋子。呼叫端再依物件大小加上額外 margin。
 */
export const GROUND_ZONES: readonly GroundZone[] = [
  { x: HOUSE_POSITION.x, z: HOUSE_POSITION.z, halfX: 13.5, halfZ: 12.5 },
  { x: CHARACTER_POSITION.x, z: CHARACTER_POSITION.z, halfX: 4.5, halfZ: 4.5 },
  { x: COARSE_CHARACTER_POSITION.x, z: COARSE_CHARACTER_POSITION.z, halfX: 4.5, halfZ: 4.5 },
  ...treePositions().map((position) => ({
    x: position.x,
    z: position.z,
    halfX: 8,
    halfZ: 8,
  })),
];

/** 取樣重試上限。被排除的面積占比很低，正常一兩次就成功。 */
const MAX_ATTEMPTS = 32;

export function isBlocked(x: number, z: number, margin: number): boolean {
  return GROUND_ZONES.some(
    (zone) =>
      Math.abs(x - zone.x) <= zone.halfX + margin && Math.abs(z - zone.z) <= zone.halfZ + margin,
  );
}

/** 在圓環（半徑 minRadius ~ maxRadius）上取一個不穿模的點。 */
export function sampleOpenRing(
  rng: Rng,
  minRadius: number,
  maxRadius: number,
  margin: number,
): { x: number; z: number } {
  let x = 0;
  let z = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const angle = range(rng, 0, Math.PI * 2);
    const radius = range(rng, minRadius, maxRadius);
    x = Math.cos(angle) * radius;
    z = Math.sin(angle) * radius;
    if (!isBlocked(x, z, margin)) {
      return { x, z };
    }
  }
  return { x, z };
}

/** 在圓盤（面積均勻，半徑 0 ~ radius）上取一個不穿模的點。 */
export function sampleOpenDisk(
  rng: Rng,
  radius: number,
  margin: number,
): { x: number; z: number } {
  let x = 0;
  let z = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const angle = range(rng, 0, Math.PI * 2);
    const distance = Math.sqrt(rng()) * radius;
    x = Math.cos(angle) * distance;
    z = Math.sin(angle) * distance;
    if (!isBlocked(x, z, margin)) {
      return { x, z };
    }
  }
  return { x, z };
}
