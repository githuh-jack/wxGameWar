import type { City, CityProduct, CitySize, Owner, Resources } from './types';
import { emptyResources } from './types';

interface CityDef {
  name: string;
  x: number;
  y: number;
  owner: Owner;
  size: CitySize;
  product: CityProduct;
  troops: number;
  neighbors: number[];
  init?: Partial<Resources>; // 初始资源储备
}

export interface EdgePath {
  from: number;
  to: number;
  cx: number;
  cy: number;
}

// 城市规模配置：半径 / 兵力上限 / 资源上限 / 兵力增速 / 资源增速
const SIZE_CONFIG: Record<CitySize, {
  radius: number;
  maxTroops: number;
  maxResource: number;
  growth: number;
  rate: number;
}> = {
  small: { radius: 20, maxTroops: 45, maxResource: 50, growth: 0.6, rate: 0.6 },
  medium: { radius: 26, maxTroops: 65, maxResource: 80, growth: 0.9, rate: 1.0 },
  large: { radius: 32, maxTroops: 90, maxResource: 120, growth: 1.2, rate: 1.5 },
};

export function cityRadius(size: CitySize): number {
  return SIZE_CONFIG[size].radius;
}

// 三国城池布局（18 城）：蜀（玩家·西南）↔ 魏（敌方·东北），中立城池分布于中原
const CITY_DEFS: CityDef[] = [
  // 蜀国（玩家）- 西南
  { name: '成都', x: 120, y: 490, owner: 'player', size: 'large', product: 'troops', troops: 40, neighbors: [1, 2, 3], init: { iron: 20, wood: 20, stone: 20, food: 20 } },
  { name: '汉中', x: 220, y: 370, owner: 'player', size: 'medium', product: 'food', troops: 20, neighbors: [0, 3, 8, 9], init: { food: 30 } },
  { name: '永安', x: 200, y: 570, owner: 'player', size: 'small', product: 'wood', troops: 14, neighbors: [0, 12], init: { wood: 20 } },
  { name: '江州', x: 80, y: 410, owner: 'player', size: 'small', product: 'iron', troops: 14, neighbors: [0, 1, 17], init: { iron: 20 } },
  // 魏国（敌方）- 东北
  { name: '许昌', x: 840, y: 160, owner: 'enemy', size: 'large', product: 'troops', troops: 40, neighbors: [5, 6, 7, 14], init: { iron: 20, wood: 20, stone: 20, food: 20 } },
  { name: '洛阳', x: 740, y: 290, owner: 'enemy', size: 'medium', product: 'iron', troops: 20, neighbors: [4, 6, 10, 15], init: { iron: 30 } },
  { name: '邺城', x: 680, y: 90, owner: 'enemy', size: 'medium', product: 'stone', troops: 20, neighbors: [4, 5, 15], init: { stone: 30 } },
  { name: '北海', x: 880, y: 270, owner: 'enemy', size: 'small', product: 'wood', troops: 14, neighbors: [4, 10], init: { wood: 20 } },
  // 中立 - 中原与南北
  { name: '长安', x: 360, y: 270, owner: 'neutral', size: 'medium', product: 'troops', troops: 16, neighbors: [1, 9, 17] },
  { name: '襄阳', x: 490, y: 390, owner: 'neutral', size: 'large', product: 'food', troops: 22, neighbors: [1, 8, 13, 16] },
  { name: '下邳', x: 810, y: 400, owner: 'neutral', size: 'medium', product: 'troops', troops: 16, neighbors: [5, 7, 11, 14] },
  { name: '建业', x: 690, y: 500, owner: 'neutral', size: 'medium', product: 'wood', troops: 16, neighbors: [10, 13] },
  { name: '柴桑', x: 330, y: 540, owner: 'neutral', size: 'small', product: 'food', troops: 12, neighbors: [2, 13, 16] },
  { name: '江陵', x: 560, y: 510, owner: 'neutral', size: 'medium', product: 'stone', troops: 16, neighbors: [9, 11, 12, 16] },
  { name: '寿春', x: 730, y: 230, owner: 'neutral', size: 'small', product: 'troops', troops: 12, neighbors: [4, 10, 15] },
  { name: '濮阳', x: 590, y: 200, owner: 'neutral', size: 'small', product: 'iron', troops: 12, neighbors: [5, 6, 14] },
  { name: '长沙', x: 440, y: 570, owner: 'neutral', size: 'small', product: 'wood', troops: 12, neighbors: [9, 12, 13] },
  { name: '武都', x: 280, y: 430, owner: 'neutral', size: 'small', product: 'stone', troops: 12, neighbors: [3, 8] },
];

// 自动生成每条边的贝塞尔控制点：取中点后沿法线方向施加小幅偏移，制造自然弯曲
export const EDGE_PATHS: EdgePath[] = CITY_DEFS.flatMap((c, i) =>
  c.neighbors
    .filter((n) => n > i)
    .map((n) => {
      const c2 = CITY_DEFS[n];
      const mx = (c.x + c2.x) / 2;
      const my = (c.y + c2.y) / 2;
      const dx = c2.x - c.x;
      const dy = c2.y - c.y;
      const len = Math.hypot(dx, dy) || 1;
      // 法线方向
      const px = -dy / len;
      const py = dx / len;
      // 基于端点坐标的确定性伪随机，使每条边弯曲方向不同但稳定
      const seed = ((c.x * 7 + c2.y * 13 + i * 31) % 100) / 100; // 0..1
      const offset = (seed - 0.5) * len * 0.18;
      return { from: i, to: n, cx: mx + px * offset, cy: my + py * offset };
    }),
);

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 600;

export function createMap(): City[] {
  return CITY_DEFS.map((def, i) => {
    const cfg = SIZE_CONFIG[def.size];
    return {
      id: i,
      x: def.x,
      y: def.y,
      name: def.name,
      owner: def.owner,
      size: def.size,
      product: def.product,
      troops: def.troops,
      maxTroops: cfg.maxTroops,
      growthRate: cfg.growth,
      resources: addInit(def.init),
      maxResource: cfg.maxResource,
      resourceRate: cfg.rate,
      neighbors: def.neighbors,
      pulse: 0,
      flash: 0,
      captureFlash: 0,
    };
  });
}

function addInit(init?: Partial<Resources>): Resources {
  return { ...emptyResources(), ...init };
}

// 双向查找路径定义
export function findEdgePath(from: number, to: number): EdgePath | undefined {
  return EDGE_PATHS.find(
    (p) => (p.from === from && p.to === to) || (p.from === to && p.to === from),
  );
}

// 贝塞尔曲线上的点（t: 0..1）
export function pointOnBezier(
  x1: number, y1: number, cx: number, cy: number,
  x2: number, y2: number, t: number,
): { x: number; y: number } {
  const it = 1 - t;
  return {
    x: it * it * x1 + 2 * it * t * cx + t * t * x2,
    y: it * it * y1 + 2 * it * t * cy + t * t * y2,
  };
}

// 路径上的点（优先曲线，回退直线）
export function pointOnPath(
  cities: City[], fromId: number, toId: number, t: number,
): { x: number; y: number } {
  const from = cities[fromId];
  const to = cities[toId];
  if (!from || !to) return { x: 0, y: 0 };
  const path = findEdgePath(fromId, toId);
  if (path) {
    return pointOnBezier(from.x, from.y, path.cx, path.cy, to.x, to.y, t);
  }
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

// 路径总长度（数值积分近似）
export function pathLength(cities: City[], fromId: number, toId: number): number {
  const steps = 40;
  let len = 0;
  let prev = pointOnPath(cities, fromId, toId, 0);
  for (let i = 1; i <= steps; i++) {
    const curr = pointOnPath(cities, fromId, toId, i / steps);
    len += Math.hypot(curr.x - prev.x, curr.y - prev.y);
    prev = curr;
  }
  return len;
}
