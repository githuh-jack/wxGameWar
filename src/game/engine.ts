import type { Army, City, GameStats, GameState, Resources, Soldier } from './types';
import { emptyResources } from './types';
import { cityRadius, createMap, MAP_HEIGHT, MAP_WIDTH, pointOnPath, pathLength } from './map';

// 创建初始游戏状态
export function createGameState(): GameState {
  return {
    cities: createMap(),
    armies: [],
    selectedCityId: null,
    isDragging: false,
    dragTo: null,
    hoverCityId: null,
    status: 'playing',
    elapsedMs: 0,
    nextAiDecisionAt: 2500,
    shake: 0,
    flashes: [],
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    camera: { x: 0, y: 0, scale: 1, minScale: 1 },
    armyIdSeq: 1,
  };
}

// 重置游戏
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

// 计算并设置最小缩放（刚好容纳整张地图），同时将缩放重置为最小值并居中
export function fitCamera(state: GameState, viewW: number, viewH: number) {
  state.width = viewW;
  state.height = viewH;
  const fit = Math.min(viewW / MAP_WIDTH, viewH / MAP_HEIGHT);
  state.camera.minScale = Math.max(0.2, fit);
  state.camera.scale = state.camera.minScale;
  centerCamera(state);
}

// 视口尺寸变化时更新相机（保留当前缩放与视角，仅重新约束范围）
export function resizeCamera(state: GameState, viewW: number, viewH: number) {
  state.width = viewW;
  state.height = viewH;
  const fit = Math.min(viewW / MAP_WIDTH, viewH / MAP_HEIGHT);
  state.camera.minScale = Math.max(0.2, fit);
  state.camera.scale = clamp(state.camera.scale, state.camera.minScale, MAX_SCALE);
  clampCamera(state);
}

// 将地图居中于视口
function centerCamera(state: GameState) {
  const worldW = state.width / state.camera.scale;
  const worldH = state.height / state.camera.scale;
  state.camera.x = (MAP_WIDTH - worldW) / 2;
  state.camera.y = (MAP_HEIGHT - worldH) / 2;
}

// 限制相机不超出地图边界
export function clampCamera(state: GameState) {
  const worldW = state.width / state.camera.scale;
  const worldH = state.height / state.camera.scale;
  const maxX = MAP_WIDTH - worldW;
  const maxY = MAP_HEIGHT - worldH;
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

// 派遣兵力：从 fromId 向 toId 派遣 50% 兵力
export function dispatch(state: GameState, fromId: number, toId: number, ratio = 0.5) {
  const from = state.cities[fromId];
  const to = state.cities[toId];
  if (!from || !to) return;
  if (!from.neighbors.includes(toId)) return;
  if (from.owner === 'neutral') return;
  const sent = Math.max(1, Math.floor(from.troops * ratio));
  if (sent < 1) return;
  from.troops -= sent;

  // 生成像素士兵群
  const soldiers = createSoldiers(sent);
  const troopsPerSoldier = sent / soldiers.length;
  // 按路径实际长度计算速度：固定像素速度，使路程越长耗时越长
  // 典型路径约 180px → 约 30 秒；设 pixelSpeed = 6 px/s
  const PIXEL_SPEED = 6;
  const pLen = pathLength(state.cities, fromId, toId);
  const speed = pLen > 0 ? PIXEL_SPEED / pLen : 1 / 30;
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
    const maxHp = 10 + (Math.random() - 0.5) * 4; // 8..12
    const atkInterval = 0.5 + (Math.random() - 0.5) * 0.2; // 0.4..0.6
    soldiers.push({
      progress: -row * QUEUE_SPACING, // 同一行同时出发，行间依次滞后
      offsetA: (col - (columns - 1) / 2) * COLUMN_SPACING, // 列偏移：居中分布
      offsetPhase: Math.random() * Math.PI * 2,
      speedMul: 1, // 统一速度维持队列
      trail: [],
      hp: maxHp,
      maxHp,
      atk: 2 + (Math.random() - 0.5) * 1, // 1.5..2.5
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
        // 占领成功：剩余兵力驻守（可突破上限）
        to.owner = army.owner;
        to.troops = Math.max(0, -to.troops);
        to.resources = emptyResources();
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

// 主更新函数
export function update(state: GameState, dtMs: number) {
  if (state.status !== 'playing') return;
  const dt = dtMs / 1000;
  state.elapsedMs += dtMs;

  // 兵力与物资增长（中立城市不产出）
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
    }
    if (c.pulse > 0) c.pulse = Math.max(0, c.pulse - dt * 1.2);
    if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 2.4);
    if (c.captureFlash > 0) c.captureFlash = Math.max(0, c.captureFlash - dt * 1.6);
  }

  // 选中城市持续脉冲
  if (state.selectedCityId !== null) {
    const sc = state.cities[state.selectedCityId];
    if (sc) sc.pulse = Math.min(1, sc.pulse + dt * 0.8);
  }

  // 计算每支部队中心点（基于活着的士兵平均进度）
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
    let avgP = 0;
    for (const s of alive) avgP += s.progress;
    avgP /= alive.length;
    const pos = pointOnPath(state.cities, army.fromId, army.toId, avgP);
    army.centerX = pos.x;
    army.centerY = pos.y;
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

    // 阵型打散条件（满足任一即散开，作为战术保留）：
    //   战法一：存活士兵低于出兵时一半 → 阵型溃散，自由战斗
    //   战法二：攻城时士兵像素接触城池 → 打散队列，多方位进攻
    //         （仅在部队中心已接近城池时才逐士兵检测，避免远距无谓计算）
    let contactCity = false;
    const broadR = cityRadius(to.size) + 60;
    const adx = army.centerX - to.x;
    const ady = army.centerY - to.y;
    if (adx * adx + ady * ady <= broadR * broadR) {
      const contactR = cityRadius(to.size) + 4;
      const contactR2 = contactR * contactR;
      const tnow = state.elapsedMs / 1000;
      for (const s of army.soldiers) {
        if (!s.alive) continue;
        const pos = soldierPosition(army, from, to, s, tnow, state.cities);
        const ddx = pos.x - to.x;
        const ddy = pos.y - to.y;
        if (ddx * ddx + ddy * ddy <= contactR2) {
          contactCity = true;
          break;
        }
      }
    }
    const scatterTarget =
      aliveCount < army.initialSoldierCount / 2 || contactCity ? 1 : 0;
    army.scatter += (scatterTarget - army.scatter) * Math.min(1, dt * 3);

    // 仅未交战的士兵推进；交战中的士兵停在原地战斗
    for (const s of army.soldiers) {
      if (!s.alive) continue;
      if (!s.engaged) {
        s.progress = Math.min(1, s.progress + army.speed * s.speedMul * dt);
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
