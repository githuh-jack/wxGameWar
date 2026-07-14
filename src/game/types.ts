// 游戏核心类型定义

export type Owner = 'player' | 'enemy' | 'neutral';

// 城市规模：小 / 中 / 大，影响半径、兵力上限、资源上限与产出速率
export type CitySize = 'small' | 'medium' | 'large';

// 资源类型：铁矿、木头、石头、粮食
export type ResourceType = 'iron' | 'wood' | 'stone' | 'food';

// 城市产出：兵力或四种资源之一
export type CityProduct = ResourceType | 'troops';

export const RESOURCE_TYPES: ResourceType[] = ['iron', 'wood', 'stone', 'food'];

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
}

export interface Flash {
  cityId: number;
  t: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

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
}
