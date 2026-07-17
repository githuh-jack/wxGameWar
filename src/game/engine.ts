import type { Army, Building, BuildingType, City, GameStats, GameState, MapType, Resources, Soldier } from './types';
import { emptyResources } from './types';
import {
  cityRadius, createMap, pointOnPath, pathLength, addEdgePath,
  mapWidth, mapHeight, getTerrain, pathTerrainDifficulty,
  canPlaceBuilding, getCityTilesWithRoads,
} from './map';

// ---------- 建筑系统 ----------

export interface BuildingMeta {
  name: string;
  icon: string;
  desc: string;
  maxLevel: number;
  cost: { gold: number; wood: number; stone: number }; // 每级消耗基数（升到 N 级消耗 = base × N）
  color: string;
}

export const BUILDING_META: Record<BuildingType, BuildingMeta> = {
  farm: { name: '农田', icon: '田', desc: '每级 +1.5 粮/s', maxLevel: 3, cost: { gold: 30, wood: 15, stone: 5 }, color: '#e0c060' },
  lumber: { name: '伐木场', icon: '木', desc: '每级 +1.5 木/s', maxLevel: 3, cost: { gold: 30, wood: 0, stone: 10 }, color: '#9bbf6a' },
  mine: { name: '矿场', icon: '矿', desc: '每级 +1 铁/s +1 石/s', maxLevel: 3, cost: { gold: 40, wood: 20, stone: 0 }, color: '#b0a890' },
  market: { name: '市场', icon: '市', desc: '每级 +2 金/s', maxLevel: 3, cost: { gold: 0, wood: 25, stone: 15 }, color: '#d4af37' },
  barracks: { name: '兵营', icon: '兵', desc: '每级 +0.4 兵/s', maxLevel: 3, cost: { gold: 50, wood: 20, stone: 20 }, color: '#c87850' },
  house: { name: '民居', icon: '居', desc: '每级 +50 人口上限 +0.05 民心/s', maxLevel: 3, cost: { gold: 35, wood: 20, stone: 10 }, color: '#a0b8d0' },
  armory: { name: '武器坊', icon: '械', desc: '每级 +0.8 军械/s', maxLevel: 3, cost: { gold: 45, wood: 15, stone: 20 }, color: '#c0c8d0' },
};

export const BUILDING_TYPES: BuildingType[] = ['farm', 'lumber', 'mine', 'market', 'barracks', 'house', 'armory'];

// 建造/升级建筑：消耗资源，等级 +1，新建时需指定放置坐标（2x2 左上角）
export function buildBuilding(state: GameState, cityId: number, type: BuildingType, tx: number, ty: number): boolean {
  const city = state.cities[cityId];
  if (!city || city.owner !== 'player') return false;
  const meta = BUILDING_META[type];
  const building = city.buildings.find((b) => b.type === type);
  const curLevel = building ? building.level : 0;
  if (curLevel >= meta.maxLevel) return false;
  // 新建建筑需检查放置位置
  if (!building) {
    const tiles = getCityTilesWithRoads(city);
    if (!canPlaceBuilding(tiles, city.buildings, tx, ty)) return false;
  }
  const cost = { gold: meta.cost.gold * (curLevel + 1), wood: meta.cost.wood * (curLevel + 1), stone: meta.cost.stone * (curLevel + 1) };
  // 检查金钱（本城）与木/石（全局玩家）
  if (city.gold < cost.gold) return false;
  let totalWood = 0;
  let totalStone = 0;
  for (const c of state.cities) {
    if (c.owner === 'player') {
      totalWood += c.resources.wood;
      totalStone += c.resources.stone;
    }
  }
  if (totalWood < cost.wood || totalStone < cost.stone) return false;
  // 扣减
  city.gold -= cost.gold;
  let needWood = cost.wood;
  let needStone = cost.stone;
  for (const c of state.cities) {
    if (c.owner !== 'player') continue;
    if (needWood > 0) {
      const take = Math.min(c.resources.wood, needWood);
      c.resources.wood -= take;
      needWood -= take;
    }
    if (needStone > 0) {
      const take = Math.min(c.resources.stone, needStone);
      c.resources.stone -= take;
      needStone -= take;
    }
    if (needWood <= 0 && needStone <= 0) break;
  }
  if (building) {
    building.level += 1;
  } else {
    city.buildings.push({ type, level: 1, x: tx, y: ty } as Building);
  }
  // 民居升级立即增加人口上限
  if (type === 'house') city.maxPopulation += 50;
  return true;
}

// 建造城内道路（1x1，仅草地可建，消耗石5）
export function buildCityRoad(state: GameState, cityId: number, tx: number, ty: number): boolean {
  const city = state.cities[cityId];
  if (!city || city.owner !== 'player') return false;
  const tiles = getCityTilesWithRoads(city);
  const dim = tiles.length;
  if (tx < 0 || ty < 0 || tx >= dim || ty >= dim) return false;
  if (tiles[ty][tx] !== 'grass') return false;
  // 不能建在已有建筑上
  for (const b of city.buildings) {
    if (b.x < 0) continue;
    if (tx >= b.x && tx <= b.x + 1 && ty >= b.y && ty <= b.y + 1) return false;
  }
  // 消耗石头（全局玩家）
  const ROAD_COST = 5;
  let totalStone = 0;
  for (const c of state.cities) {
    if (c.owner === 'player') totalStone += c.resources.stone;
  }
  if (totalStone < ROAD_COST) return false;
  let need = ROAD_COST;
  for (const c of state.cities) {
    if (c.owner !== 'player') continue;
    if (need > 0) {
      const take = Math.min(c.resources.stone, need);
      c.resources.stone -= take;
      need -= take;
    }
    if (need <= 0) break;
  }
  city.roads.push({ x: tx, y: ty });
  return true;
}

// 创建初始游戏状态（默认进入地图选择界面）
export function createGameState(): GameState {
  return {
    cities: [],
    armies: [],
    selectedCityId: null,
    isDragging: false,
    dragTo: null,
    hoverCityId: null,
    status: 'selecting',
    elapsedMs: 0,
    nextAiDecisionAt: 2500,
    shake: 0,
    flashes: [],
    width: 960,
    height: 600,
    camera: { x: 0, y: 0, scale: 1, minScale: 1 },
    armyIdSeq: 1,
    dispatchRatio: 0.5,
    buildRoadFrom: null,
    selectedArmyId: null,
    mapType: 'classic',
    mapW: 960,
    mapH: 600,
    spiedCities: {},
    redirectFromArmyId: null,
    terrainInspect: null,
    cityViewId: null,
    nextMoraleCheckAt: 12000,
  };
}

// 选择地图后开始游戏
export function startGame(type: MapType): GameState {
  const state = createGameState();
  state.mapType = type;
  state.mapW = mapWidth(type);
  state.mapH = mapHeight(type);
  state.cities = createMap(type);
  state.status = 'playing';
  state.width = state.mapW;
  state.height = state.mapH;
  return state;
}

// 重置游戏（回到地图选择）
export function resetGame(): GameState {
  return createGameState();
}

// 统计信息
export function computeStats(state: GameState): GameStats {
  let playerCities = 0;
  let enemyCities = 0;
  let playerTroops = 0;
  let enemyTroops = 0;
  const playerResources: Resources = emptyResources();
  const enemyResources: Resources = emptyResources();
  for (const c of state.cities) {
    if (c.owner === 'player') {
      playerCities++;
      playerTroops += Math.floor(c.troops);
      playerResources.iron += Math.floor(c.resources.iron);
      playerResources.wood += Math.floor(c.resources.wood);
      playerResources.stone += Math.floor(c.resources.stone);
      playerResources.food += Math.floor(c.resources.food);
    } else if (c.owner === 'enemy') {
      enemyCities++;
      enemyTroops += Math.floor(c.troops);
      enemyResources.iron += Math.floor(c.resources.iron);
      enemyResources.wood += Math.floor(c.resources.wood);
      enemyResources.stone += Math.floor(c.resources.stone);
      enemyResources.food += Math.floor(c.resources.food);
    }
  }
  for (const a of state.armies) {
    if (a.owner === 'player') playerTroops += Math.floor(a.count);
    else if (a.owner === 'enemy') enemyTroops += Math.floor(a.count);
  }
  return {
    playerCities,
    enemyCities,
    playerTroops,
    enemyTroops,
    playerResources,
    enemyResources,
    totalCities: state.cities.length,
  };
}

// 通过坐标查找城市（命中圆形区域，半径随城市规模变化；缩放较小时保证最小点击区域）
export function findCityAt(state: GameState, x: number, y: number): City | null {
  const minScreenR = 24; // 屏幕上最小可点击半径（像素）
  for (const c of state.cities) {
    const dx = c.x - x;
    const dy = c.y - y;
    const worldR = Math.max(cityRadius(c.size) + 6, minScreenR / state.camera.scale);
    if (dx * dx + dy * dy <= worldR * worldR) return c;
  }
  return null;
}

// ---------- 相机控制 ----------

const MAX_SCALE = 2.5;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// 计算并设置最小缩放（容纳整张地图并留 10% 边距，确保地形边缘城市可见）
export function fitCamera(state: GameState, viewW: number, viewH: number) {
  state.width = viewW;
  state.height = viewH;
  const fit = Math.min(viewW / state.mapW, viewH / state.mapH) * 0.9;
  state.camera.minScale = Math.max(0.2, fit);
  state.camera.scale = state.camera.minScale;
  centerCamera(state);
}

// 视口尺寸变化时更新相机（保留当前缩放与视角，仅重新约束范围）
export function resizeCamera(state: GameState, viewW: number, viewH: number) {
  state.width = viewW;
  state.height = viewH;
  const fit = Math.min(viewW / state.mapW, viewH / state.mapH) * 0.9;
  state.camera.minScale = Math.max(0.2, fit);
  state.camera.scale = clamp(state.camera.scale, state.camera.minScale, MAX_SCALE);
  clampCamera(state);
}

// 将地图居中于视口
function centerCamera(state: GameState) {
  const worldW = state.width / state.camera.scale;
  const worldH = state.height / state.camera.scale;
  state.camera.x = (state.mapW - worldW) / 2;
  state.camera.y = (state.mapH - worldH) / 2;
}

// 限制相机不超出地图边界
export function clampCamera(state: GameState) {
  const worldW = state.width / state.camera.scale;
  const worldH = state.height / state.camera.scale;
  const maxX = state.mapW - worldW;
  const maxY = state.mapH - worldH;
  state.camera.x = maxX > 0
    ? clamp(state.camera.x, 0, maxX)
    : clamp(state.camera.x, maxX, 0);
  state.camera.y = maxY > 0
    ? clamp(state.camera.y, 0, maxY)
    : clamp(state.camera.y, maxY, 0);
}

// 拖动地图（dx/dy 为屏幕像素位移）
export function panCamera(state: GameState, dx: number, dy: number) {
  state.camera.x -= dx / state.camera.scale;
  state.camera.y -= dy / state.camera.scale;
  clampCamera(state);
}

// 缩放（factor 为倍率，centerX/centerY 为屏幕坐标缩放中心）
export function zoomCamera(state: GameState, factor: number, centerX: number, centerY: number) {
  const newScale = clamp(state.camera.scale * factor, state.camera.minScale, MAX_SCALE);
  // 保持屏幕中心点对应的世界坐标不变
  const worldX = centerX / state.camera.scale + state.camera.x;
  const worldY = centerY / state.camera.scale + state.camera.y;
  state.camera.scale = newScale;
  state.camera.x = worldX - centerX / newScale;
  state.camera.y = worldY - centerY / newScale;
  clampCamera(state);
}

// 判断两城市是否相邻
export function areAdjacent(state: GameState, a: number, b: number): boolean {
  const city = state.cities[a];
  return !!city && city.neighbors.includes(b);
}

// 建造道路：两座己方城市间消耗物资建造道路（已相邻则不可重复建造）
const ROAD_COST: Resources = { iron: 0, wood: 30, stone: 20, food: 0 };
export function buildRoad(state: GameState, aId: number, bId: number): boolean {
  const a = state.cities[aId];
  const b = state.cities[bId];
  if (!a || !b) return false;
  if (a.owner !== 'player' || b.owner !== 'player') return false;
  if (a.neighbors.includes(bId)) return false; // 已有道路
  // 检查全局物资是否充足
  const total = emptyResources();
  for (const c of state.cities) {
    if (c.owner === 'player') {
      total.wood += c.resources.wood;
      total.stone += c.resources.stone;
    }
  }
  if (total.wood < ROAD_COST.wood || total.stone < ROAD_COST.stone) return false;
  // 依次从己方城市扣减
  let needWood = ROAD_COST.wood;
  let needStone = ROAD_COST.stone;
  for (const c of state.cities) {
    if (c.owner !== 'player') continue;
    if (needWood > 0) {
      const take = Math.min(c.resources.wood, needWood);
      c.resources.wood -= take;
      needWood -= take;
    }
    if (needStone > 0) {
      const take = Math.min(c.resources.stone, needStone);
      c.resources.stone -= take;
      needStone -= take;
    }
    if (needWood <= 0 && needStone <= 0) break;
  }
  // 添加双向邻接与渲染路径
  a.neighbors.push(bId);
  b.neighbors.push(aId);
  addEdgePath(aId, bId);
  return true;
}

// 查找点击位置附近的己方军队（用于选中军队）
export function findArmyAt(state: GameState, x: number, y: number): Army | null {
  const r = 28; // 增大选中半径，便于触屏点击
  const r2 = r * r;
  for (const a of state.armies) {
    if (a.owner !== 'player') continue;
    const dx = a.centerX - x;
    const dy = a.centerY - y;
    if (dx * dx + dy * dy <= r2) return a;
  }
  return null;
}

// 切换军队驻扎/继续行军
export function toggleCamp(state: GameState, armyId: number) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army || army.owner !== 'player') return;
  army.camped = !army.camped;
}

// 撤退：军队掉头返回出发城市
export function retreatArmy(state: GameState, armyId: number) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army || army.owner !== 'player') return;
  // 交换 from/to，反转进度（1 - progress）
  const oldFrom = army.fromId;
  army.fromId = army.toId;
  army.toId = oldFrom;
  for (const s of army.soldiers) {
    if (s.alive) s.progress = 1 - s.progress;
  }
  // 更新路径长度与速度
  const pLen = pathLength(state.cities, army.fromId, army.toId);
  const terrainCost = pathTerrainDifficulty(state.cities, army.fromId, army.toId, getTerrain(state.mapType));
  const PIXEL_SPEED = 6;
  const effectiveSpeed = PIXEL_SPEED / terrainCost;
  army.pathLen = pLen;
  army.speed = pLen > 0 ? effectiveSpeed / pLen : 1 / 30;
  army.camped = false; // 撤退即出发
}

// 改道：将驻扎军队的目标改为新城市（新目标须与当前出发城市相邻）
export function redirectArmy(state: GameState, armyId: number, newToId: number) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army || army.owner !== 'player') return;
  const from = state.cities[army.fromId];
  if (!from || !from.neighbors.includes(newToId)) return;
  if (newToId === army.fromId) return;
  army.toId = newToId;
  for (const s of army.soldiers) {
    if (s.alive) s.progress = 0; // 从出发城市重新出发
  }
  const pLen = pathLength(state.cities, army.fromId, army.toId);
  const terrainCost = pathTerrainDifficulty(state.cities, army.fromId, army.toId, getTerrain(state.mapType));
  const PIXEL_SPEED = 6;
  const effectiveSpeed = PIXEL_SPEED / terrainCost;
  army.pathLen = pLen;
  army.speed = pLen > 0 ? effectiveSpeed / pLen : 1 / 30;
  army.camped = false;
}

// 刺探：花费粮食揭示敌方/中立城池兵力（持续 30 秒）
const SPY_COST = 10;
const SPY_DURATION = 30000;
export function spyCity(state: GameState, cityId: number): boolean {
  const city = state.cities[cityId];
  if (!city || city.owner === 'player') return false;
  // 检查全局粮食是否足够
  let totalFood = 0;
  for (const c of state.cities) {
    if (c.owner === 'player') totalFood += Math.floor(c.resources.food);
  }
  if (totalFood < SPY_COST) return false;
  // 依次扣减
  let need = SPY_COST;
  for (const c of state.cities) {
    if (c.owner !== 'player') continue;
    if (need <= 0) break;
    const take = Math.min(c.resources.food, need);
    c.resources.food -= take;
    need -= take;
  }
  state.spiedCities[cityId] = state.elapsedMs + SPY_DURATION;
  return true;
}

// 判断城池是否已被刺探（仍在有效期内）
export function isCitySpied(state: GameState, cityId: number): boolean {
  const expiry = state.spiedCities[cityId];
  return expiry !== undefined && state.elapsedMs < expiry;
}

// 派遣兵力：从 fromId 向 toId 派遣指定比例兵力（默认取 state.dispatchRatio）
export function dispatch(state: GameState, fromId: number, toId: number, ratio?: number) {
  const from = state.cities[fromId];
  const to = state.cities[toId];
  if (!from || !to) return;
  if (!from.neighbors.includes(toId)) return;
  if (from.owner === 'neutral') return;
  const r = ratio ?? state.dispatchRatio;
  // 出兵兵力以 5 为整倍数（最少 5）
  const raw = Math.floor(from.troops * r);
  const sent = Math.floor(raw / 5) * 5;
  if (sent < 5) return;
  from.troops -= sent;

  // 军械加成：若有足够军械，消耗等量军械，士兵攻击 +50%
  const armed = from.weapons >= sent;
  if (armed) from.weapons -= sent;

  // 生成像素士兵群
  const soldiers = createSoldiers(sent);
  if (armed) {
    for (const s of soldiers) s.atk *= 1.5;
  }
  const troopsPerSoldier = sent / soldiers.length;
  // 按路径实际长度计算速度：固定像素速度，使路程越长耗时越长
  // 典型路径约 180px → 约 30 秒；设 pixelSpeed = 6 px/s
  // 地形影响：山地/河流等行军更慢，草原更快
  const PIXEL_SPEED = 6;
  const pLen = pathLength(state.cities, fromId, toId);
  const terrainCost = pathTerrainDifficulty(state.cities, fromId, toId, getTerrain(state.mapType));
  const effectiveSpeed = PIXEL_SPEED / terrainCost;
  const speed = pLen > 0 ? effectiveSpeed / pLen : 1 / 30;
  state.armies.push({
    id: state.armyIdSeq++,
    fromId,
    toId,
    owner: from.owner,
    count: sent,
    soldiers,
    speed,
    elapsed: 0,
    troopsPerSoldier,
    pathLen: pLen,
    centerX: from.x,
    centerY: from.y,
    inCombat: false,
    initialSoldierCount: soldiers.length,
    scatter: 0,
    camped: false,
  });
}

function createSoldiers(count: number): Soldier[] {
  // 战斗实体数量封顶，保证性能
  const visual = Math.min(20, Math.max(4, Math.ceil(count / 2)));
  const soldiers: Soldier[] = [];
  // 多列阵型：列数由实际数量决定（每5个一列，最少1列，最多4列）
  const columns = Math.max(1, Math.ceil(visual / 5));
  const COLUMN_SPACING = 7; // 列间距（垂直于路径方向，像素）
  const QUEUE_SPACING = 0.018; // 行间距（沿路径进度，错开出发形成纵队）
  for (let i = 0; i < visual; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const maxHp = 22 + (Math.random() - 0.5) * 6; // 19..25，提高血量拉长对等战斗
    const atkInterval = 0.85 + (Math.random() - 0.5) * 0.2; // 0.75..0.95，降低攻击频率
    soldiers.push({
      progress: -row * QUEUE_SPACING, // 同一行同时出发，行间依次滞后
      offsetA: (col - (columns - 1) / 2) * COLUMN_SPACING, // 列偏移：居中分布
      offsetPhase: Math.random() * Math.PI * 2,
      speedMul: 1, // 统一速度维持队列
      trail: [],
      hp: maxHp,
      maxHp,
      atk: 1.4 + (Math.random() - 0.5) * 0.6, // 1.1..1.7，降低攻击力让对等战斗更长
      atkInterval,
      atkCooldown: Math.random() * atkInterval,
      alive: true,
      hitFlash: 0,
      engaged: false,
    });
  }
  return soldiers;
}

// 士兵像素接触半径（士兵本体 2×2，加余量判定碰撞）
const SOLDIER_CONTACT_RADIUS = 7;
// 部队中心感知范围（仅用于宽相筛选可能接触的部队对，不直接参与战斗判定）
const ARMY_SENSE_RADIUS = 80;

// 处理士兵间像素碰撞战斗：只有士兵像素点实际接触才互相攻击
function resolveSoldierCombat(state: GameState, dt: number) {
  // 重置交战状态
  for (const army of state.armies) {
    army.inCombat = false;
    for (const s of army.soldiers) s.engaged = false;
  }

  const time = state.elapsedMs / 1000;
  const armies = state.armies;

  // 统一推进攻击冷却（每帧每士兵只扣一次，避免多次接触导致冷却扣多）
  for (const army of armies) {
    for (const s of army.soldiers) {
      if (s.alive) s.atkCooldown -= dt;
    }
  }

  const r2 = SOLDIER_CONTACT_RADIUS * SOLDIER_CONTACT_RADIUS;
  for (let i = 0; i < armies.length; i++) {
    const a = armies[i];
    if (a.owner === 'neutral') continue;
    const fromA = state.cities[a.fromId];
    const toA = state.cities[a.toId];
    if (!fromA || !toA) continue;
    for (let j = i + 1; j < armies.length; j++) {
      const b = armies[j];
      if (b.owner === 'neutral') continue;
      if (a.owner === b.owner) continue;

      // 宽相感知：部队中心过远则不可能有士兵像素接触
      const cdx = a.centerX - b.centerX;
      const cdy = a.centerY - b.centerY;
      if (cdx * cdx + cdy * cdy > ARMY_SENSE_RADIUS * ARMY_SENSE_RADIUS) continue;

      const fromB = state.cities[b.fromId];
      const toB = state.cities[b.toId];
      if (!fromB || !toB) continue;

      const aAlive = a.soldiers.filter((s) => s.alive);
      const bAlive = b.soldiers.filter((s) => s.alive);
      if (aAlive.length === 0 || bAlive.length === 0) continue;

      // 预计算存活士兵当前像素坐标
      const posA = aAlive.map((s) => soldierPosition(a, fromA, toA, s, time, state.cities));
      const posB = bAlive.map((s) => soldierPosition(b, fromB, toB, s, time, state.cities));

      // 逐对判定像素接触
      for (let ia = 0; ia < aAlive.length; ia++) {
        const sa = aAlive[ia];
        const pa = posA[ia];
        for (let ib = 0; ib < bAlive.length; ib++) {
          const sb = bAlive[ib];
          if (!sb.alive) continue;
          const pb = posB[ib];
          const dx = pa.x - pb.x;
          const dy = pa.y - pb.y;
          if (dx * dx + dy * dy > r2) continue;

          // 像素接触 → 进入交战
          sa.engaged = true;
          sb.engaged = true;
          a.inCombat = true;
          b.inCombat = true;

          // sa 攻击 sb
          if (sa.atkCooldown <= 0 && sb.alive) {
            sb.hp -= sa.atk;
            sb.hitFlash = 1;
            sa.atkCooldown = sa.atkInterval;
            if (sb.hp <= 0) {
              sb.alive = false;
              b.count = Math.max(0, b.count - b.troopsPerSoldier);
            }
          }
          // sb 反击 sa（仅当 sb 仍存活）
          if (sb.alive && sb.atkCooldown <= 0 && sa.alive) {
            sa.hp -= sb.atk;
            sa.hitFlash = 1;
            sb.atkCooldown = sb.atkInterval;
            if (sa.hp <= 0) {
              sa.alive = false;
              a.count = Math.max(0, a.count - a.troopsPerSoldier);
            }
          }
        }
      }
    }
  }
}

// 攻城结算：逐士兵入城（像素接触城市本体即进入，每帧至多1名）
function resolveSiege(state: GameState, army: Army, from: City, to: City) {
  const time = state.elapsedMs / 1000;
  // 入城判定半径：城市本体半径 + 小余量（士兵像素碰到城池即进入）
  const enterR = cityRadius(to.size) + 2;
  const enterR2 = enterR * enterR;
  for (const s of army.soldiers) {
    if (!s.alive) continue;
    const pos = soldierPosition(army, from, to, s, time, state.cities);
    const dx = pos.x - to.x;
    const dy = pos.y - to.y;
    if (dx * dx + dy * dy > enterR2) continue;
    // 像素接触城市 → 该士兵进入城内
    s.alive = false;
    const dmg = army.troopsPerSoldier;
    army.count = Math.max(0, army.count - dmg);

    if (to.owner === army.owner) {
      // 增援：合并兵力，可突破上限（自增不突破，但增援可以）
      to.troops += dmg;
      to.flash = Math.max(to.flash, 0.4);
    } else {
      // 攻城：扣减守军
      to.troops -= dmg;
      to.flash = 1;
      state.shake = Math.max(state.shake, 0.12);
      if (to.troops <= 0) {
        // 占领成功：剩余兵力驻守（可突破上限），建筑被毁，民心重置
        to.owner = army.owner;
        to.troops = Math.max(0, -to.troops);
        to.resources = emptyResources();
        to.buildings = [];
        to.roads = [];
        to.morale = 50;
        to.gold = Math.max(0, to.gold * 0.5);
        to.weapons = 0;
        to.captureFlash = 1;
        to.flash = 1;
        state.shake = Math.max(state.shake, 0.6);
        state.flashes.push({ cityId: to.id, t: 1 });
      }
    }
    // 每帧只处理一名士兵入城（依次进入，非一下全部涌入）
    return;
  }
}

// AI 决策
function aiDecide(state: GameState) {
  const enemyCities = state.cities.filter((c) => c.owner === 'enemy' && c.troops >= 8);
  if (enemyCities.length === 0) return;

  // 收集所有可行进攻动作
  const moves: { from: City; to: City; score: number }[] = [];
  for (const c of enemyCities) {
    for (const nid of c.neighbors) {
      const n = state.cities[nid];
      if (!n) continue;
      if (n.owner === 'enemy') {
        // 偶尔增援薄弱友城
        if (n.troops < 8 && c.troops > 16 && Math.random() < 0.25) {
          moves.push({ from: c, to: n, score: 5 + Math.random() * 3 });
        }
        continue;
      }
      // 进攻中立或玩家城市
      if (c.troops > n.troops + 2) {
        // 越接近前线、能打下的城市分越高
        const isPlayer = n.owner === 'player' ? 6 : 0;
        const strength = (c.troops - n.troops) * 0.4;
        moves.push({ from: c, to: n, score: 8 + isPlayer + strength + Math.random() * 3 });
      }
    }
  }

  if (moves.length === 0) return;
  moves.sort((a, b) => b.score - a.score);
  // 从前 3 个高分动作中随机选一个，避免过于机械
  const pick = moves[Math.floor(Math.random() * Math.min(3, moves.length))];
  dispatch(state, pick.from.id, pick.to.id, 0.5);
}

// 建筑产出：根据已建造建筑等级额外产出资源/金钱/兵力/军械
function applyBuildings(c: City, dt: number) {
  for (const b of c.buildings) {
    const lvl = b.level;
    switch (b.type) {
      case 'farm':
        c.resources.food = Math.min(c.maxResource, c.resources.food + 1.5 * lvl * dt);
        break;
      case 'lumber':
        c.resources.wood = Math.min(c.maxResource, c.resources.wood + 1.5 * lvl * dt);
        break;
      case 'mine':
        c.resources.iron = Math.min(c.maxResource, c.resources.iron + 1 * lvl * dt);
        c.resources.stone = Math.min(c.maxResource, c.resources.stone + 1 * lvl * dt);
        break;
      case 'market':
        c.gold += 2 * lvl * dt;
        break;
      case 'barracks':
        c.troops = Math.min(c.maxTroops, c.troops + 0.4 * lvl * dt);
        break;
      case 'house':
        // 人口上限在建造时已增加，此处不重复处理
        break;
      case 'armory':
        c.weapons += 0.8 * lvl * dt;
        break;
    }
  }
}

// 民心变化：驻军、民居、粮食影响
function updateMorale(c: City, dt: number) {
  let delta = 0;
  if (c.troops >= 10) delta += 0.04;
  else if (c.troops < 5) delta -= 0.08;
  const house = c.buildings.find((b) => b.type === 'house');
  if (house) delta += 0.05 * house.level;
  if (c.resources.food >= 10) delta += 0.02;
  else if (c.resources.food < 5) delta -= 0.15;
  c.morale = Math.max(0, Math.min(100, c.morale + delta * dt));
}

// 民心事件：民心过低时独立为中立，极低时投靠邻近最强敌方
function checkMoraleEvents(state: GameState) {
  for (const c of state.cities) {
    if (c.owner !== 'player') continue;
    if (c.morale < 15) {
      // 极低：有概率投靠邻近最强敌方
      if (Math.random() < 0.25) {
        let strongest: City | null = null;
        for (const nid of c.neighbors) {
          const n = state.cities[nid];
          if (n && n.owner === 'enemy' && (!strongest || n.troops > strongest.troops)) strongest = n;
        }
        c.owner = strongest ? 'enemy' : 'neutral';
        c.morale = 50;
        c.captureFlash = 1;
        state.flashes.push({ cityId: c.id, t: 1 });
      }
    } else if (c.morale < 30) {
      // 过低：有概率独立为中立
      if (Math.random() < 0.15) {
        c.owner = 'neutral';
        c.morale = 50;
        c.captureFlash = 1;
        state.flashes.push({ cityId: c.id, t: 1 });
      }
    }
  }
}

// 主更新函数
export function update(state: GameState, dtMs: number) {
  if (state.status !== 'playing') return;
  const dt = dtMs / 1000;
  state.elapsedMs += dtMs;

  // 兵力、物资、建筑产出与民心（中立城市不产出）
  for (const c of state.cities) {
    if (c.owner !== 'neutral') {
      if (c.product === 'troops') {
        if (c.troops < c.maxTroops) {
          c.troops = Math.min(c.maxTroops, c.troops + c.growthRate * dt);
        }
      } else {
        // 资源城市产出对应物资
        const cur = c.resources[c.product];
        if (cur < c.maxResource) {
          c.resources[c.product] = Math.min(c.maxResource, cur + c.resourceRate * dt);
        }
        // 资源城市也缓慢产出少量兵力（驻军自然恢复，速率较低）
        if (c.troops < c.maxTroops) {
          c.troops = Math.min(c.maxTroops, c.troops + c.growthRate * 0.35 * dt);
        }
      }
      // 建筑产出（额外加成）
      applyBuildings(c, dt);
      // 人口自然增长（受民居上限影响）
      if (c.population < c.maxPopulation) {
        c.population = Math.min(c.maxPopulation, c.population + 0.6 * dt);
      }
      // 税收：人口产生金钱
      c.gold += c.population * 0.002 * dt;
    }
    // 民心变化（仅玩家城市，敌方/中立固定）
    if (c.owner === 'player') {
      updateMorale(c, dt);
    }
    if (c.pulse > 0) c.pulse = Math.max(0, c.pulse - dt * 1.2);
    if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 2.4);
    if (c.captureFlash > 0) c.captureFlash = Math.max(0, c.captureFlash - dt * 1.6);
  }

  // 周期性民心事件：过低独立为中立，极低投靠邻近敌方
  if (state.elapsedMs >= state.nextMoraleCheckAt) {
    state.nextMoraleCheckAt = state.elapsedMs + 12000;
    checkMoraleEvents(state);
  }

  // 选中城市持续脉冲
  if (state.selectedCityId !== null) {
    const sc = state.cities[state.selectedCityId];
    if (sc) sc.pulse = Math.min(1, sc.pulse + dt * 0.8);
  }

  // 计算每支部队中心点（用所有存活士兵实际像素位置的几何中心，选中点正好在士兵中间）
  const timeForPos = state.elapsedMs / 1000;
  for (const army of state.armies) {
    const from = state.cities[army.fromId];
    const to = state.cities[army.toId];
    if (!from || !to) continue;
    const alive = army.soldiers.filter((s) => s.alive);
    if (alive.length === 0) {
      army.centerX = from.x;
      army.centerY = from.y;
      continue;
    }
    // 取所有存活士兵实际像素位置的平均值（视觉中心，命中选中）
    let sumX = 0;
    let sumY = 0;
    for (const s of alive) {
      const p = soldierPosition(army, from, to, s, timeForPos, state.cities);
      sumX += p.x;
      sumY += p.y;
    }
    army.centerX = sumX / alive.length;
    army.centerY = sumY / alive.length;
  }

  // 士兵像素碰撞战斗
  resolveSoldierCombat(state, dt);

  // 士兵行进与受击衰减
  const wiped: Army[] = [];
  for (const army of state.armies) {
    army.elapsed += dt;
    const from = state.cities[army.fromId];
    const to = state.cities[army.toId];
    if (!from || !to) {
      wiped.push(army);
      continue;
    }

    // 受击闪烁衰减
    for (const s of army.soldiers) {
      if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt * 4);
    }

    // 全灭部队清理
    const aliveCount = army.soldiers.filter((s) => s.alive).length;
    if (aliveCount === 0) {
      wiped.push(army);
      continue;
    }

    // 不再散开：保持队列行进与战斗
    army.scatter = 0;

    // 驻扎军队停止行进；非交战士兵推进
    if (!army.camped) {
      for (const s of army.soldiers) {
        if (!s.alive) continue;
        if (!s.engaged) {
          s.progress = Math.min(1, s.progress + army.speed * s.speedMul * dt);
        }
      }
    }

    // 逐士兵攻城：像素接触城市本体即进入（每帧至多1名，依次进入）
    resolveSiege(state, army, from, to);
  }
  if (wiped.length > 0) {
    state.armies = state.armies.filter((a) => !wiped.includes(a));
  }

  // 屏幕抖动衰减
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);

  // 战斗闪光衰减
  for (const f of state.flashes) f.t = Math.max(0, f.t - dt * 2);
  state.flashes = state.flashes.filter((f) => f.t > 0);

  // AI 决策
  if (state.elapsedMs >= state.nextAiDecisionAt) {
    aiDecide(state);
    state.nextAiDecisionAt = state.elapsedMs + 2200 + Math.random() * 2400;
  }

  // 胜负判定
  const stats = computeStats(state);
  if (stats.playerCities === 0) state.status = 'lost';
  else if (stats.enemyCities === 0) state.status = 'won';
}

// 计算士兵当前坐标（沿曲线路径移动，含多列偏移与散开摆动）
export function soldierPosition(
  army: Army,
  from: City,
  to: City,
  s: Soldier,
  time: number,
  cities: City[],
): { x: number; y: number } {
  // 出城从边缘开始：将士兵进度偏移 p_edge，使 progress=0 对应城池边缘而非中心
  const rA = cityRadius(from.size);
  const p_edge = army.pathLen > 0 ? rA / army.pathLen : 0;
  const pathP = s.progress + p_edge; // 实际路径进度

  let base: { x: number; y: number };
  let tx: number, ty: number;

  if (pathP < p_edge) {
    // 队列中（尚未到边缘）：从城池边缘沿切线向后线性排列
    const edgePt = pointOnPath(cities, army.fromId, army.toId, p_edge);
    const nextPt = pointOnPath(cities, army.fromId, army.toId, Math.min(1, p_edge + 0.01));
    const dx = nextPt.x - edgePt.x;
    const dy = nextPt.y - edgePt.y;
    const len = Math.hypot(dx, dy) || 1;
    tx = dx / len;
    ty = dy / len;
    const backDist = (p_edge - pathP) * army.pathLen;
    base = { x: edgePt.x - tx * backDist, y: edgePt.y - ty * backDist };
  } else {
    // 已出城：沿曲线行进
    const pc = Math.min(1, pathP);
    base = pointOnPath(cities, army.fromId, army.toId, pc);
    const eps = 0.002;
    const prev = pointOnPath(cities, army.fromId, army.toId, Math.max(0, pc - eps));
    const next = pointOnPath(cities, army.fromId, army.toId, Math.min(1, pc + eps));
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    tx = dx / len;
    ty = dy / len;
  }

  const nx = -ty; // 垂直方向（列偏移方向）
  const ny = tx;
  // 接近终点时收敛偏移：使士兵能汇入城市而非被偏移推到城外
  // p=0 时 approach=1（全偏移），p=1 时 approach=0（无偏移，正好入城）
  const approach = Math.max(0, 1 - s.progress);
  const scatterMul = 1 + army.scatter * 5 * approach;
  // 列偏移（垂直于路径），打散时放大
  const perp = s.offsetA * scatterMul;
  // 散开时沿路径方向的随机扩散（每个士兵不同，形成多方位散开）
  const tan = Math.sin(s.offsetPhase * 1.7) * 8 * army.scatter * approach;
  // 微小呼吸摆动（队列时紧凑，打散时增大）
  const wave = Math.sin(time * 4 + s.offsetPhase) * (0.4 + army.scatter * 2);
  return {
    x: base.x + nx * (perp + wave) + tx * tan,
    y: base.y + ny * (perp + wave) + ty * tan,
  };
}
