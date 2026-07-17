// 游戏核心类型定义

export type Owner = 'player' | 'enemy' | 'neutral';

// 地形类型：平原、草原、山地、树林、沼泽、河流、湖泊、沙漠、瘴气、雪地
export type TerrainType =
  | 'plain' | 'grassland' | 'mountain' | 'forest' | 'swamp'
  | 'river' | 'lake' | 'desert' | 'miasma' | 'snow';

// 地形区域：矩形或圆形
export interface TerrainRect {
  type: TerrainType;
  x: number; y: number; w: number; h: number;
}
export interface TerrainCircle {
  type: TerrainType;
  cx: number; cy: number; r: number;
}
export type TerrainRegion = TerrainRect | TerrainCircle;

// 地图类型
export type MapType = 'classic' | 'large';

// 城市规模：小 / 中 / 大，影响半径、兵力上限、资源上限与产出速率
export type CitySize = 'small' | 'medium' | 'large';

// 资源类型：铁矿、木头、石头、粮食
export type ResourceType = 'iron' | 'wood' | 'stone' | 'food';

// 城市产出：兵力或四种资源之一
export type CityProduct = ResourceType | 'troops';

export const RESOURCE_TYPES: ResourceType[] = ['iron', 'wood', 'stone', 'food'];

// 建筑类型：农田、伐木场、矿场、市场、兵营、民居、武器坊
export type BuildingType =
  | 'farm' | 'lumber' | 'mine' | 'market' | 'barracks' | 'house' | 'armory';

export interface Building {
  type: BuildingType;
  level: number;
  x: number; // 城内 tilemap 坐标（2x2 建筑左上角，-1=未放置）
  y: number;
}

// 城内 tilemap 地块类型
export type CityTileType = 'grass' | 'tree' | 'water' | 'road' | 'rock';

// 文臣武将
export interface Hero {
  name: string;
  type: 'civil' | 'military'; // 文臣 / 武将
  title: string; // 官职/称号
  desc: string; // 简短描述
}

export interface Resources {
  iron: number;
  wood: number;
  stone: number;
  food: number;
}

export function emptyResources(): Resources {
  return { iron: 0, wood: 0, stone: 0, food: 0 };
}

export function addResources(a: Resources, b: Partial<Resources>): Resources {
  return {
    iron: a.iron + (b.iron ?? 0),
    wood: a.wood + (b.wood ?? 0),
    stone: a.stone + (b.stone ?? 0),
    food: a.food + (b.food ?? 0),
  };
}

export interface City {
  id: number;
  x: number;
  y: number;
  name: string;
  owner: Owner;
  size: CitySize;
  product: CityProduct; // 产出类型：troops=兵力，其他=对应资源
  troops: number;
  maxTroops: number;
  growthRate: number; // 每秒增长兵力数（仅 product=troops 时有效）
  resources: Resources; // 当前四种资源储备
  maxResource: number; // 单种资源上限
  resourceRate: number; // 资源产出速率（仅 product!=troops 时有效）
  neighbors: number[];
  pulse: number; // 选中脉冲动画相位 0..1
  flash: number; // 战斗爆闪强度 0..1
  captureFlash: number; // 易主闪光 0..1
  // 城市扩展属性
  population: number; // 人口
  maxPopulation: number; // 人口上限
  gold: number; // 金钱
  weapons: number; // 军械
  morale: number; // 民心 0..100
  buildings: Building[]; // 已建造建筑
  roads: { x: number; y: number }[]; // 玩家建造的城内道路（1x1 tile 坐标）
  heroes: Hero[]; // 城内文臣武将
}

export interface TrailPoint {
  x: number;
  y: number;
  a: number; // alpha
}

export interface Soldier {
  progress: number; // 0..1 沿路径进度
  offsetA: number; // 垂直偏移幅度
  offsetPhase: number; // 偏移相位
  speedMul: number; // 速度倍率
  trail: TrailPoint[];
  // 战斗属性
  hp: number;
  maxHp: number;
  atk: number; // 攻击力
  atkInterval: number; // 攻击频率（秒/次）
  atkCooldown: number; // 当前攻击冷却
  alive: boolean;
  hitFlash: number; // 受击闪烁 0..1
  engaged: boolean; // 是否正在与敌方士兵像素接触交战（每帧重置）
}

export interface Army {
  id: number;
  fromId: number;
  toId: number;
  owner: Owner;
  count: number;
  soldiers: Soldier[];
  speed: number; // 每秒进度
  elapsed: number;
  troopsPerSoldier: number; // 每个士兵代表的兵力值
  pathLen: number; // 路径像素长度（用于出城边缘起算与队列间距换算）
  centerX: number; // 部队当前中心 x（每帧更新）
  centerY: number; // 部队当前中心 y
  inCombat: boolean; // 是否正在交战（交战时停止移动）
  initialSoldierCount: number; // 出兵时士兵总数（用于判定队列打散）
  scatter: number; // 阵型散开程度 0..1（0=整齐队列，1=完全散开战斗）
  camped: boolean; // 是否驻扎（停止行进，原地待命，可恢复）
}

export interface Flash {
  cityId: number;
  t: number;
}

export type GameStatus = 'selecting' | 'playing' | 'won' | 'lost';

export interface GameStats {
  playerCities: number;
  enemyCities: number;
  playerTroops: number;
  enemyTroops: number;
  playerResources: Resources;
  enemyResources: Resources;
  totalCities: number;
}

export interface Camera {
  x: number; // 视口左上角对应的世界坐标 x
  y: number; // 视口左上角对应的世界坐标 y
  scale: number; // 缩放倍率
  minScale: number; // 最小缩放（刚好显示整张地图）
}

export interface GameState {
  cities: City[];
  armies: Army[];
  selectedCityId: number | null;
  isDragging: boolean;
  dragTo: { x: number; y: number } | null;
  hoverCityId: number | null;
  status: GameStatus;
  elapsedMs: number;
  nextAiDecisionAt: number;
  shake: number;
  flashes: Flash[];
  width: number; // 视口宽（逻辑像素）
  height: number; // 视口高（逻辑像素）
  camera: Camera;
  armyIdSeq: number;
  dispatchRatio: number; // 出兵比例（0..1），可于出兵前调整
  buildRoadFrom: number | null; // 建造道路模式：起点城市 id（null=未进入建路模式）
  selectedArmyId: number | null; // 选中的军队 id（用于驻扎等指令）
  mapType: MapType; // 当前地图类型
  mapW: number; // 当前地图宽度（像素）
  mapH: number; // 当前地图高度（像素）
  spiedCities: Record<number, number>; // 刺探：cityId → 过期时间 elapsedMs
  redirectFromArmyId: number | null; // 改道模式：选中军队 id（null=未进入改道模式）
  terrainInspect: { x: number; y: number; type: TerrainType } | null; // 地形查看：点击空白处记录的位置与地形
  cityViewId: number | null; // 城内视图：正在查看内政的城市 id（null=大地图模式）
  nextMoraleCheckAt: number; // 下次民心事件检查时间（elapsedMs）
}
