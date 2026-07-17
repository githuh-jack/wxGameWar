import type { Building, City, CityProduct, CitySize, CityTileType, Hero, MapType, Owner, Resources, TerrainRegion, TerrainType } from './types';
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

// ---------- 地形元数据 ----------

// 地形配置：颜色 / 行军消耗倍率 / 中文名
export const TERRAIN_META: Record<TerrainType, { color: string; cost: number; label: string }> = {
  plain:     { color: '#1a2228', cost: 1.0, label: '平原' },
  grassland: { color: '#1e2818', cost: 0.9, label: '草原' },
  mountain:  { color: '#322820', cost: 1.6, label: '山地' },
  forest:    { color: '#142018', cost: 1.2, label: '树林' },
  swamp:     { color: '#2a2418', cost: 1.5, label: '沼泽' },
  river:     { color: '#102838', cost: 1.8, label: '河流' },
  lake:      { color: '#0a1c2e', cost: 2.5, label: '湖泊' },
  desert:    { color: '#322a18', cost: 1.3, label: '沙漠' },
  miasma:    { color: '#241a28', cost: 1.4, label: '瘴气' },
  snow:      { color: '#202830', cost: 1.5, label: '雪地' },
};

// 经典地图地形区域（960×600）
const CLASSIC_TERRAIN: TerrainRegion[] = [
  // 山地
  { type: 'mountain', x: 300, y: 200, w: 90, h: 70 },
  { type: 'mountain', x: 600, y: 140, w: 70, h: 50 },
  // 河流（长江）
  { type: 'river', x: 0, y: 475, w: 960, h: 10 },
  // 湖泊
  { type: 'lake', cx: 450, cy: 455, r: 28 },
  // 树林
  { type: 'forest', x: 100, y: 400, w: 80, h: 60 },
  { type: 'forest', x: 700, y: 300, w: 110, h: 75 },
  // 沼泽
  { type: 'swamp', x: 350, y: 540, w: 90, h: 50 },
  // 草原
  { type: 'grassland', x: 480, y: 280, w: 120, h: 80 },
];

// 大地图地形区域（1600×1000）
const LARGE_TERRAIN: TerrainRegion[] = [
  // —— 山地 ——
  { type: 'mountain', x: 0,   y: 450, w: 130, h: 260 },  // 蜀地西界屏障
  { type: 'mountain', x: 550, y: 300, w: 130, h: 80 },   // 秦岭
  { type: 'mountain', x: 860, y: 70,  w: 200, h: 60 },   // 北方山脉
  { type: 'mountain', x: 1060,y: 470, w: 100, h: 65 },   // 大别山
  { type: 'mountain', x: 1340,y: 320, w: 260, h: 200 },  // 东南山区（下邳/会稽之间）
  { type: 'mountain', x: 420, y: 680, w: 200, h: 220 },  // 武陵/荆州西部山地
  { type: 'mountain', x: 760, y: 440, w: 120, h: 130 },  // 荆州中部山地
  { type: 'mountain', x: 80,  y: 60,  w: 360, h: 160 },  // 北部山地扩展
  { type: 'mountain', x: 1180,y: 640, w: 160, h: 120 },  // 庐江以南山地
  { type: 'mountain', x: 1280,y: 880, w: 320, h: 120 },  // 东南角山地
  // —— 河流 ——
  { type: 'river', x: 0, y: 642, w: 1600, h: 14 },        // 长江
  { type: 'river', x: 0, y: 222, w: 1150, h: 12 },        // 黄河
  // —— 湖泊 ——
  { type: 'lake', cx: 960,  cy: 780, r: 38 },             // 鄱阳湖
  { type: 'lake', cx: 1300, cy: 580, r: 32 },             // 太湖
  // —— 树林 ——
  { type: 'forest', x: 400, y: 790, w: 150, h: 100 },
  { type: 'forest', x: 1050,y: 590, w: 120, h: 80 },
  { type: 'forest', x: 200, y: 540, w: 80,  h: 60 },
  // —— 沼泽 ——
  { type: 'swamp', x: 740, y: 860, w: 110, h: 60 },
  // —— 沙漠 ——
  { type: 'desert', x: 1400, y: 0, w: 200, h: 100 },
  // —— 雪地 ——
  { type: 'snow', x: 0, y: 0, w: 500, h: 70 },
  // —— 瘴气 ——
  { type: 'miasma', x: 290, y: 940, w: 130, h: 60 },
  // —— 草原 ——
  { type: 'grassland', x: 600,  y: 400, w: 200, h: 150 },
  { type: 'grassland', x: 1100, y: 550, w: 150, h: 100 },
];

// ---------- 城市规模配置 ----------

const SIZE_CONFIG: Record<CitySize, {
  radius: number;
  maxTroops: number;
  maxResource: number;
  growth: number;
  rate: number;
  population: number; // 初始人口
  maxPopulation: number; // 人口上限
}> = {
  small: { radius: 20, maxTroops: 45, maxResource: 50, growth: 0.6, rate: 0.6, population: 120, maxPopulation: 360 },
  medium: { radius: 26, maxTroops: 65, maxResource: 80, growth: 0.9, rate: 1.0, population: 240, maxPopulation: 720 },
  large: { radius: 32, maxTroops: 90, maxResource: 120, growth: 1.2, rate: 1.5, population: 480, maxPopulation: 1440 },
};

export function cityRadius(size: CitySize): number {
  return SIZE_CONFIG[size].radius;
}

// ---------- 经典地图城池（18 城） ----------

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

// ---------- 大地图城池（30 城 · 三国争霸） ----------

const LARGE_CITY_DEFS: CityDef[] = [
  // 蜀国（玩家）- 西南 0-7
  { name: '成都', x: 180, y: 820, owner: 'player', size: 'large', product: 'troops', troops: 40, neighbors: [3, 5, 4], init: { iron: 20, wood: 20, stone: 20, food: 20 } },
  { name: '汉中', x: 340, y: 620, owner: 'player', size: 'medium', product: 'food', troops: 22, neighbors: [6, 28, 11], init: { food: 30 } },
  { name: '永安', x: 320, y: 900, owner: 'player', size: 'small', product: 'wood', troops: 14, neighbors: [3, 7], init: { wood: 20 } },
  { name: '江州', x: 160, y: 700, owner: 'player', size: 'small', product: 'iron', troops: 14, neighbors: [0, 2, 5], init: { iron: 20 } },
  { name: '建宁', x: 220, y: 940, owner: 'player', size: 'small', product: 'food', troops: 12, neighbors: [0, 7], init: { food: 15 } },
  { name: '阆中', x: 280, y: 760, owner: 'player', size: 'small', product: 'stone', troops: 14, neighbors: [0, 3, 6], init: { stone: 20 } },
  { name: '阴平', x: 240, y: 580, owner: 'player', size: 'small', product: 'wood', troops: 12, neighbors: [5, 28, 1], init: { wood: 15 } },
  { name: '涪陵', x: 380, y: 850, owner: 'player', size: 'small', product: 'food', troops: 12, neighbors: [2, 4, 20], init: { food: 15 } },
  // 魏国（敌方）- 东北 8-14
  { name: '洛阳', x: 1050, y: 280, owner: 'enemy', size: 'large', product: 'troops', troops: 40, neighbors: [9, 10, 15], init: { iron: 20, wood: 20, stone: 20, food: 20 } },
  { name: '许昌', x: 1180, y: 400, owner: 'enemy', size: 'large', product: 'troops', troops: 36, neighbors: [8, 13, 29], init: { iron: 20, wood: 20, stone: 20, food: 20 } },
  { name: '邺城', x: 1020, y: 160, owner: 'enemy', size: 'medium', product: 'stone', troops: 22, neighbors: [8, 13, 14], init: { stone: 30 } },
  { name: '长安', x: 720, y: 360, owner: 'enemy', size: 'medium', product: 'troops', troops: 24, neighbors: [1, 28, 15], init: { iron: 20, food: 20 } },
  { name: '北海', x: 1340, y: 280, owner: 'enemy', size: 'small', product: 'wood', troops: 16, neighbors: [13, 25], init: { wood: 20 } },
  { name: '濮阳', x: 1240, y: 240, owner: 'enemy', size: 'small', product: 'iron', troops: 16, neighbors: [9, 10, 12], init: { iron: 20 } },
  { name: '晋阳', x: 920, y: 100, owner: 'enemy', size: 'small', product: 'stone', troops: 14, neighbors: [10], init: { stone: 20 } },
  // 中立 - 中原、荆州、江东 15-29
  { name: '宛', x: 880, y: 440, owner: 'neutral', size: 'medium', product: 'troops', troops: 18, neighbors: [8, 11, 16] },
  { name: '襄阳', x: 820, y: 580, owner: 'neutral', size: 'large', product: 'food', troops: 24, neighbors: [15, 17, 18] },
  { name: '新野', x: 740, y: 520, owner: 'neutral', size: 'small', product: 'food', troops: 14, neighbors: [16, 27] },
  { name: '江陵', x: 860, y: 720, owner: 'neutral', size: 'medium', product: 'stone', troops: 18, neighbors: [16, 19, 21] },
  { name: '长沙', x: 720, y: 880, owner: 'neutral', size: 'small', product: 'wood', troops: 14, neighbors: [18, 20, 21] },
  { name: '武陵', x: 600, y: 880, owner: 'neutral', size: 'small', product: 'food', troops: 12, neighbors: [19, 7] },
  { name: '柴桑', x: 940, y: 820, owner: 'neutral', size: 'medium', product: 'wood', troops: 18, neighbors: [18, 22, 23] },
  { name: '建业', x: 1280, y: 720, owner: 'neutral', size: 'large', product: 'troops', troops: 26, neighbors: [21, 23, 24] },
  { name: '庐江', x: 1160, y: 600, owner: 'neutral', size: 'medium', product: 'iron', troops: 18, neighbors: [21, 22, 29] },
  { name: '吴', x: 1320, y: 840, owner: 'neutral', size: 'small', product: 'food', troops: 14, neighbors: [22, 26] },
  { name: '下邳', x: 1360, y: 500, owner: 'neutral', size: 'medium', product: 'troops', troops: 18, neighbors: [23, 29, 12] },
  { name: '会稽', x: 1420, y: 860, owner: 'neutral', size: 'small', product: 'wood', troops: 12, neighbors: [24] },
  { name: '上庸', x: 600, y: 520, owner: 'neutral', size: 'small', product: 'stone', troops: 14, neighbors: [17, 28] },
  { name: '武都', x: 500, y: 580, owner: 'neutral', size: 'small', product: 'iron', troops: 14, neighbors: [1, 6, 11, 27] },
  { name: '寿春', x: 1180, y: 500, owner: 'neutral', size: 'medium', product: 'troops', troops: 18, neighbors: [9, 23, 25] },
];

// ---------- 边路径（贝塞尔控制点） ----------

// 当前激活的城市定义（由 createMap 根据 mapType 设置）
let activeCityDefs: CityDef[] = CITY_DEFS;

// 自动生成每条边的贝塞尔控制点
function generateEdgePaths(defs: CityDef[]): EdgePath[] {
  return defs.flatMap((c, i) =>
    c.neighbors
      .filter((n) => n > i)
      .map((n) => {
        const c2 = defs[n];
        const mx = (c.x + c2.x) / 2;
        const my = (c.y + c2.y) / 2;
        const dx = c2.x - c.x;
        const dy = c2.y - c.y;
        const len = Math.hypot(dx, dy) || 1;
        const px = -dy / len;
        const py = dx / len;
        const seed = ((c.x * 7 + c2.y * 13 + i * 31) % 100) / 100;
        const offset = (seed - 0.5) * len * 0.06;
        return { from: i, to: n, cx: mx + px * offset, cy: my + py * offset };
      }),
  );
}

// 边路径（可变，切换地图时重新生成）
export let EDGE_PATHS: EdgePath[] = generateEdgePaths(CITY_DEFS);

// 切换地图时重新生成边路径
export function regenerateEdgePaths(defs: CityDef[]): void {
  activeCityDefs = defs;
  EDGE_PATHS = generateEdgePaths(defs);
}

// ---------- 地图尺寸 ----------

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 600;
export const LARGE_MAP_WIDTH = 1600;
export const LARGE_MAP_HEIGHT = 1000;

export function mapWidth(type: MapType): number {
  return type === 'large' ? LARGE_MAP_WIDTH : MAP_WIDTH;
}
export function mapHeight(type: MapType): number {
  return type === 'large' ? LARGE_MAP_HEIGHT : MAP_HEIGHT;
}

// ---------- 地形查询 ----------

// 获取指定地图类型的地形区域
export function getTerrain(mapType: MapType): TerrainRegion[] {
  return mapType === 'large' ? LARGE_TERRAIN : CLASSIC_TERRAIN;
}

// 查询某点地形类型（从后往前匹配，后定义的区域在上层）
export function terrainAt(x: number, y: number, regions: TerrainRegion[]): TerrainType {
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    if ('w' in r) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.type;
    } else {
      const dx = x - r.cx;
      const dy = y - r.cy;
      if (dx * dx + dy * dy <= r.r * r.r) return r.type;
    }
  }
  return 'plain';
}

// 沿路径采样地形，返回平均行军消耗倍率（>1 表示变慢）
export function pathTerrainDifficulty(
  cities: City[], fromId: number, toId: number, regions: TerrainRegion[],
): number {
  const samples = 12;
  let total = 0;
  for (let i = 0; i < samples; i++) {
    const t = (i + 0.5) / samples;
    const pt = pointOnPath(cities, fromId, toId, t);
    total += TERRAIN_META[terrainAt(pt.x, pt.y, regions)].cost;
  }
  return total / samples;
}

// ---------- 创建城市 ----------

// 文臣武将定义（按城名映射，两张地图共用）
const HERO_DEFS: Record<string, Hero[]> = {
  // 蜀
  '成都': [
    { name: '诸葛亮', type: 'civil', title: '丞相', desc: '卧龙先生，治国安邦' },
    { name: '关羽', type: 'military', title: '前将军', desc: '武圣，义薄云天' },
    { name: '张飞', type: 'military', title: '车骑将军', desc: '万人敌，勇猛无双' },
  ],
  '汉中': [
    { name: '魏延', type: 'military', title: '镇北将军', desc: '镇守汉中多年' },
    { name: '法正', type: 'civil', title: '尚书令', desc: '善奇谋，取汉中' },
  ],
  '永安': [{ name: '李严', type: 'civil', title: '托孤大臣', desc: '辅政重臣' }],
  '江州': [{ name: '张翼', type: 'military', title: '左车骑将军', desc: '蜀汉后期将领' }],
  '建宁': [{ name: '李恢', type: 'civil', title: '安汉将军', desc: '平定南中' }],
  '阆中': [{ name: '马超', type: 'military', title: '骠骑将军', desc: '锦马超，西凉铁骑' }],
  '阴平': [{ name: '姜维', type: 'military', title: '大将军', desc: '继承遗志，北伐中原' }],
  '涪陵': [{ name: '邓芝', type: 'civil', title: '车骑将军', desc: '出使东吴，修复联盟' }],
  // 魏
  '洛阳': [
    { name: '司马懿', type: 'civil', title: '太傅', desc: '冢虎，谋略深沉' },
    { name: '夏侯惇', type: 'military', title: '大将军', desc: '盲夏侯，魏之栋梁' },
    { name: '张辽', type: 'military', title: '前将军', desc: '威震逍遥津' },
  ],
  '许昌': [
    { name: '荀彧', type: 'civil', title: '尚书令', desc: '王佐之才' },
    { name: '典韦', type: 'military', title: '校尉', desc: '古之恶来' },
  ],
  '邺城': [
    { name: '曹仁', type: 'military', title: '大司马', desc: '曹氏宗族，善守' },
    { name: '陈群', type: 'civil', title: '司空', desc: '制九品官人法' },
  ],
  '长安': [
    { name: '钟会', type: 'military', title: '镇西将军', desc: '灭蜀主帅之一' },
    { name: '郝昭', type: 'military', title: '杂号将军', desc: '陈仓拒诸葛' },
  ],
  '北海': [{ name: '于禁', type: 'military', title: '左将军', desc: '魏五子良将' }],
  '濮阳': [{ name: '乐进', type: 'military', title: '右将军', desc: '先登陷阵' }],
  '晋阳': [{ name: '郭淮', type: 'military', title: '雍州刺史', desc: '镇守雍凉' }],
  // 中立/吴
  '宛': [{ name: '文聘', type: 'military', title: '江夏太守', desc: '镇守江夏' }],
  '襄阳': [{ name: '蒯越', type: 'civil', title: '章陵太守', desc: '佐刘表平荆襄' }],
  '新野': [{ name: '徐庶', type: 'civil', title: '军师', desc: '走马荐诸葛' }],
  '江陵': [{ name: '霍峻', type: 'military', title: '裨将军', desc: '守葭萌城' }],
  '长沙': [{ name: '黄忠', type: 'military', title: '后将军', desc: '老当益壮，神射手' }],
  '武陵': [{ name: '巩志', type: 'civil', title: '武陵太守', desc: '献城归降' }],
  '柴桑': [{ name: '周瑜', type: 'military', title: '大都督', desc: '赤壁之战，英姿勃发' }],
  '建业': [
    { name: '孙策', type: 'military', title: '讨逆将军', desc: '小霸王，平定江东' },
    { name: '张昭', type: 'civil', title: '长史', desc: '内事问张昭' },
  ],
  '庐江': [{ name: '鲁肃', type: 'civil', title: '赞军校尉', desc: '联刘抗曹' }],
  '吴': [{ name: '陆逊', type: 'civil', title: '大都督', desc: '火烧连营' }],
  '下邳': [{ name: '陈登', type: 'civil', title: '广陵太守', desc: '智谋过人' }],
  '会稽': [{ name: '虞翻', type: 'civil', title: '骑都尉', desc: '江东大儒' }],
  '上庸': [{ name: '申耽', type: 'military', title: '征北将军', desc: '上庸守将' }],
  '武都': [{ name: '杨阜', type: 'civil', title: '凉州刺史', desc: '忠义之士' }],
  '寿春': [{ name: '陈泰', type: 'military', title: '雍州刺史', desc: '镇守边关' }],
};

// 获取城内 tilemap（含玩家建造的道路覆盖）
export function getCityTilesWithRoads(city: City): CityTileType[][] {
  const tiles = generateCityTiles(city.id, city.size);
  for (const r of city.roads) {
    if (r.y >= 0 && r.y < tiles.length && r.x >= 0 && r.x < tiles[0].length) {
      tiles[r.y][r.x] = 'road';
    }
  }
  return tiles;
}

export function createMap(type: MapType = 'classic'): City[] {
  const defs = type === 'large' ? LARGE_CITY_DEFS : CITY_DEFS;
  regenerateEdgePaths(defs);
  return defs.map((def, i) => {
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
      neighbors: [...def.neighbors],
      pulse: 0,
      flash: 0,
      captureFlash: 0,
      population: cfg.population,
      maxPopulation: cfg.maxPopulation,
      gold: 50,
      weapons: 0,
      morale: 70,
      buildings: [],
      roads: [],
      heroes: [...(HERO_DEFS[def.name] ?? [])],
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

// 运行时添加新道路（建造道路用）：基于当前激活的城市定义生成控制点
export function addEdgePath(from: number, to: number): void {
  if (findEdgePath(from, to)) return;
  const c1 = activeCityDefs[from];
  const c2 = activeCityDefs[to];
  if (!c1 || !c2) return;
  const mx = (c1.x + c2.x) / 2;
  const my = (c1.y + c2.y) / 2;
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const seed = ((c1.x * 7 + c2.y * 13 + from * 31) % 100) / 100;
  const offset = (seed - 0.5) * len * 0.06;
  EDGE_PATHS.push({ from, to, cx: mx + px * offset, cy: my + py * offset });
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

// ---------- 城内 tilemap ----------

export const CITY_TILE_SIZE = 28; // 每 tile 像素

// 城内地图尺寸（按城市规模）
export function cityTileDim(size: CitySize): number {
  return size === 'large' ? 24 : size === 'medium' ? 20 : 16;
}

// 城内地块元数据
export const CITY_TILE_META: Record<CityTileType, { color: string; label: string }> = {
  grass: { color: '#1e2a1e', label: '草地' },
  tree: { color: '#142014', label: '树林' },
  water: { color: '#102838', label: '水域' },
  road: { color: '#3a3428', label: '道路' },
  rock: { color: '#2a2620', label: '岩石' },
};

// 确定性伪随机
function seededRand(seed: number): () => number {
  let s = seed > 0 ? seed : 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// 生成城内 tilemap（基于城市 id 确定性生成，建筑占 2x2）
export function generateCityTiles(cityId: number, size: CitySize): CityTileType[][] {
  const dim = cityTileDim(size);
  const rand = seededRand(cityId * 7919 + 13);
  const tiles: CityTileType[][] = [];
  for (let y = 0; y < dim; y++) {
    const row: CityTileType[] = [];
    for (let x = 0; x < dim; x++) {
      row.push('grass');
    }
    tiles.push(row);
  }
  // 散布树林
  for (let i = 0; i < dim * dim * 0.1; i++) {
    const x = Math.floor(rand() * dim);
    const y = Math.floor(rand() * dim);
    tiles[y][x] = 'tree';
  }
  // 散布岩石
  for (let i = 0; i < dim * dim * 0.05; i++) {
    const x = Math.floor(rand() * dim);
    const y = Math.floor(rand() * dim);
    tiles[y][x] = 'rock';
  }
  // 散布水域
  for (let i = 0; i < dim * dim * 0.03; i++) {
    const x = Math.floor(rand() * dim);
    const y = Math.floor(rand() * dim);
    tiles[y][x] = 'water';
  }
  // 中央横向道路
  const roadY = Math.floor(dim / 2);
  for (let x = 0; x < dim; x++) {
    if (tiles[roadY][x] === 'grass') tiles[roadY][x] = 'road';
  }
  // 中央纵向道路
  const roadX = Math.floor(dim / 2);
  for (let y = 0; y < dim; y++) {
    if (tiles[y][roadX] === 'grass') tiles[y][roadX] = 'road';
  }
  return tiles;
}

// 检查 2x2 区域是否可放置建筑（全部为 grass 且无其他建筑占用）
export function canPlaceBuilding(
  tiles: CityTileType[][],
  buildings: Building[],
  tx: number,
  ty: number,
): boolean {
  const dim = tiles.length;
  if (tx < 0 || ty < 0 || tx + 1 >= dim || ty + 1 >= dim) return false;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      if (tiles[ty + dy][tx + dx] !== 'grass') return false;
    }
  }
  // 检查与其他建筑不重叠（2x2）
  for (const b of buildings) {
    if (b.x < 0) continue;
    if (Math.abs(b.x - tx) < 2 && Math.abs(b.y - ty) < 2) return false;
  }
  return true;
}
