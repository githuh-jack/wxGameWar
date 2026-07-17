import type { City, GameState, Owner, ResourceType, TerrainRegion } from './types';
import { isCitySpied, soldierPosition } from './engine';
import { cityRadius, findEdgePath, getTerrain, pointOnPath, TERRAIN_META } from './map';

// 资源显示配置：标签 / 颜色
const RESOURCE_META: Record<ResourceType, { icon: string; color: string }> = {
  iron: { icon: '铁', color: '#c8c9d0' },
  wood: { icon: '木', color: '#9bbf6a' },
  stone: { icon: '石', color: '#b0a890' },
  food: { icon: '粮', color: '#e0c060' },
};

// 阵营配色
const COLORS: Record<Owner, { main: string; glow: string; dim: string }> = {
  player: { main: '#e8b04b', glow: 'rgba(232,176,75,0.55)', dim: 'rgba(232,176,75,0.18)' },
  enemy: { main: '#d83a3a', glow: 'rgba(216,58,58,0.55)', dim: 'rgba(216,58,58,0.18)' },
  neutral: { main: '#6b7480', glow: 'rgba(107,116,128,0.4)', dim: 'rgba(107,116,128,0.14)' },
};

// 预生成噪点纹理（按地图尺寸缓存，切换地图时重新生成）
let noiseCanvas: HTMLCanvasElement | null = null;
let noiseW = 0;
let noiseH = 0;
function getNoise(w: number, h: number): HTMLCanvasElement {
  if (noiseCanvas && noiseW === w && noiseH === h) return noiseCanvas;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 18; // 极低 alpha
  }
  ctx.putImageData(img, 0, 0);
  noiseCanvas = c;
  noiseW = w;
  noiseH = h;
  return c;
}

// 绘制地形区域背景
function drawTerrain(ctx: CanvasRenderingContext2D, regions: TerrainRegion[], mapW: number, mapH: number) {
  // 先填充平原底色
  ctx.fillStyle = TERRAIN_META.plain.color;
  ctx.fillRect(0, 0, mapW, mapH);
  // 依次绘制各地形区域
  for (const r of regions) {
    ctx.fillStyle = TERRAIN_META[r.type].color;
    if ('w' in r) {
      ctx.fillRect(r.x, r.y, r.w, r.h);
    } else {
      ctx.beginPath();
      ctx.arc(r.cx, r.cy, r.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const w = state.width;
  const h = state.height;
  const cam = state.camera;

  ctx.save();

  // 屏幕抖动
  if (state.shake > 0) {
    const s = state.shake * 6;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  // 1. 背景（屏幕空间）
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0c1118');
  bg.addColorStop(1, '#070a0f');
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, w + 40, h + 40);

  // 应用相机变换：世界坐标 → 屏幕坐标
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x, -cam.y);

  // 2. 地形区域背景（世界空间）
  drawTerrain(ctx, getTerrain(state.mapType), state.mapW, state.mapH);

  // 3. 战术网格（世界空间，覆盖整张地图）
  ctx.strokeStyle = 'rgba(120,140,160,0.05)';
  ctx.lineWidth = 1;
  const grid = 40;
  ctx.beginPath();
  for (let x = 0; x <= state.mapW; x += grid) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, state.mapH);
  }
  for (let y = 0; y <= state.mapH; y += grid) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(state.mapW, y + 0.5);
  }
  ctx.stroke();

  // 加粗主网格线
  ctx.strokeStyle = 'rgba(120,140,160,0.08)';
  ctx.beginPath();
  for (let x = 0; x <= state.mapW; x += grid * 4) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, state.mapH);
  }
  for (let y = 0; y <= state.mapH; y += grid * 4) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(state.mapW, y + 0.5);
  }
  ctx.stroke();

  // 4. 噪点纹理（世界空间，按地图尺寸缓存）
  ctx.globalAlpha = 0.5;
  ctx.drawImage(getNoise(state.mapW, state.mapH), 0, 0);
  ctx.globalAlpha = 1;

  // 4. 邻接连线
  drawConnections(ctx, state);

  // 5. 像素士兵
  drawArmies(ctx, state, time);

  // 6. 城市节点
  for (const c of state.cities) {
    drawCity(ctx, c, state, time);
  }

  // 7. 拖拽箭头
  if (state.isDragging && state.selectedCityId !== null && state.dragTo) {
    const from = state.cities[state.selectedCityId];
    if (from) {
      // 判断是否悬停在有效相邻目标上
      let valid = false;
      const tx = state.dragTo.x;
      const ty = state.dragTo.y;
      for (const c of state.cities) {
        if (c.id === from.id) continue;
        const dx = c.x - tx;
        const dy = c.y - ty;
        const hr = cityRadius(c.size) + 6;
        if (dx * dx + dy * dy <= hr * hr && from.neighbors.includes(c.id)) {
          valid = true;
          break;
        }
      }
      drawArrow(ctx, from.x, from.y, state.dragTo.x, state.dragTo.y, valid, cityRadius(from.size));
    }
  }

  // 建造道路模式：源城市脉冲环
  if (state.buildRoadFrom !== null) {
    const src = state.cities[state.buildRoadFrom];
    if (src) {
      const r = cityRadius(src.size) + 8 + (Math.sin(time * 4) * 0.5 + 0.5) * 5;
      ctx.strokeStyle = 'rgba(120,200,120,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(src.x, src.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 改道模式：选中军队脉冲环
  if (state.redirectFromArmyId !== null) {
    const army = state.armies.find((a) => a.id === state.redirectFromArmyId);
    if (army) {
      const r = 20 + (Math.sin(time * 5) * 0.5 + 0.5) * 6;
      ctx.strokeStyle = 'rgba(100,180,255,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(army.centerX, army.centerY, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 地形查看：点击空白处显示该地块地形信息
  if (state.terrainInspect) {
    const ti = state.terrainInspect;
    const meta = TERRAIN_META[ti.type];
    // 标记点（十字 + 圆环）
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ti.x, ti.y, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ti.x - 10, ti.y);
    ctx.lineTo(ti.x + 10, ti.y);
    ctx.moveTo(ti.x, ti.y - 10);
    ctx.lineTo(ti.x, ti.y + 10);
    ctx.stroke();
    // 信息标签
    const costStr = meta.cost.toFixed(1);
    const label = `${meta.label} · 行军 ×${costStr}`;
    ctx.font = '600 11px "JetBrains Mono", monospace';
    const tw = ctx.measureText(label).width;
    const boxW = tw + 16;
    const boxH = 22;
    const bx = ti.x + 12;
    const by = ti.y - boxH - 6;
    ctx.fillStyle = 'rgba(10,14,20,0.94)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = 'rgba(180,190,200,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);
    ctx.fillStyle = '#e0e6ed';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + 8, by + boxH / 2);
  }

  ctx.restore();

  // 8. 暗角（屏幕空间，覆盖在最上层）
  ctx.save();
  const vigR = Math.max(w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, vigR * 0.3, w / 2, h / 2, vigR * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawConnections(ctx: CanvasRenderingContext2D, state: GameState) {
  const drawn = new Set<string>();
  for (const c of state.cities) {
    for (const nid of c.neighbors) {
      const key = c.id < nid ? `${c.id}-${nid}` : `${nid}-${c.id}`;
      if (drawn.has(key)) continue;
      drawn.add(key);
      const n = state.cities[nid];
      if (!n) continue;

      const bothPlayer = c.owner === 'player' && n.owner === 'player';
      const bothEnemy = c.owner === 'enemy' && n.owner === 'enemy';
      const path = findEdgePath(c.id, n.id);

      // 底层路径（较粗、半透明）
      let stroke = 'rgba(100,115,130,0.16)';
      if (bothPlayer) stroke = 'rgba(232,176,75,0.25)';
      else if (bothEnemy) stroke = 'rgba(216,58,58,0.22)';
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      if (path) ctx.quadraticCurveTo(path.cx, path.cy, n.x, n.y);
      else ctx.lineTo(n.x, n.y);
      ctx.stroke();

      // 高光层（更细、更亮）
      let highlight = 'rgba(140,160,180,0.3)';
      if (bothPlayer) highlight = 'rgba(240,200,100,0.45)';
      else if (bothEnemy) highlight = 'rgba(230,90,90,0.38)';
      ctx.strokeStyle = highlight;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      if (path) ctx.quadraticCurveTo(path.cx, path.cy, n.x, n.y);
      else ctx.lineTo(n.x, n.y);
      ctx.stroke();
    }
  }
}

function drawArmies(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  for (const army of state.armies) {
    const from = state.cities[army.fromId];
    const to = state.cities[army.toId];
    if (!from || !to) continue;
    const col = COLORS[army.owner];

    // 交战指示：部队中心红色脉冲环
    if (army.inCombat) {
      const pulseR = 18 + (Math.sin(time * 8) * 0.5 + 0.5) * 6;
      ctx.strokeStyle = 'rgba(255,80,80,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(army.centerX, army.centerY, pulseR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 驻扎指示：部队中心黄色方框 + 选中高亮
    if (army.camped) {
      const sz = 10 + Math.sin(time * 3) * 1.5;
      ctx.strokeStyle = 'rgba(230,200,80,0.7)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(army.centerX - sz, army.centerY - sz, sz * 2, sz * 2);
    }
    if (state.selectedArmyId === army.id) {
      ctx.strokeStyle = 'rgba(255,235,150,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(army.centerX, army.centerY, 16, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const s of army.soldiers) {
      if (!s.alive) continue;
      const pos = soldierPosition(army, from, to, s, time, state.cities);

      // 拖尾
      s.trail.push({ x: pos.x, y: pos.y, a: 1 });
      if (s.trail.length > 6) s.trail.shift();
      for (let i = 0; i < s.trail.length; i++) {
        const tp = s.trail[i];
        const a = (i / s.trail.length) * 0.5;
        ctx.fillStyle = col.main;
        ctx.globalAlpha = a;
        ctx.fillRect(Math.round(tp.x) - 1, Math.round(tp.y) - 1, 2, 2);
      }
      ctx.globalAlpha = 1;

      // 像素士兵本体 2x2，加微光
      ctx.fillStyle = col.glow;
      ctx.fillRect(Math.round(pos.x) - 2, Math.round(pos.y) - 2, 4, 4);
      // 受击时白色闪烁，否则阵营色
      if (s.hitFlash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.6 + s.hitFlash * 0.4})`;
      } else {
        ctx.fillStyle = col.main;
      }
      ctx.fillRect(Math.round(pos.x) - 1, Math.round(pos.y) - 1, 2, 2);
    }

    // 兵力数值（飘在队伍上方）：己方显示数字，敌方显示 ?
    const aliveSoldiers = army.soldiers.filter((s) => s.alive);
    if (aliveSoldiers.length === 0) continue;
    const headProgress = Math.min(1, Math.max(...aliveSoldiers.map((s) => s.progress)));
    const headPos = pointOnPath(state.cities, army.fromId, army.toId, headProgress);
    const hx = headPos.x;
    const hy = headPos.y - 18;
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(hx - 14, hy - 8, 28, 14);
    ctx.fillStyle = col.main;
    ctx.fillText(army.owner === 'player' ? String(Math.floor(army.count)) : '?', hx, hy);
  }
}

function drawCity(ctx: CanvasRenderingContext2D, c: City, state: GameState, time: number) {
  const col = COLORS[c.owner];
  const r = cityRadius(c.size);
  const isSelected = state.selectedCityId === c.id;
  const isHover = state.hoverCityId === c.id;
  const isResource = c.product !== 'troops';

  // 选中脉冲扩散环
  if (isSelected || c.pulse > 0) {
    const pulseR = r + 6 + (Math.sin(time * 4) * 0.5 + 0.5) * 14;
    ctx.strokeStyle = col.main;
    ctx.globalAlpha = 0.35 * (1 - (pulseR - r - 6) / 14);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, pulseR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 外发光
  const glowR = r + 10 + c.flash * 16;
  const grad = ctx.createRadialGradient(c.x, c.y, r * 0.4, c.x, c.y, glowR);
  grad.addColorStop(0, col.glow);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c.x, c.y, glowR, 0, Math.PI * 2);
  ctx.fill();

  // 主体填充（深底）
  ctx.fillStyle = 'rgba(10,14,20,0.92)';
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();

  // 描边（资源城市用虚线区分）
  ctx.strokeStyle = col.main;
  ctx.lineWidth = isHover || isSelected ? 3 : 2;
  if (isResource) ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 内圈装饰
  ctx.strokeStyle = col.dim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r - 5, 0, Math.PI * 2);
  ctx.stroke();

  // 战斗爆闪
  if (c.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${c.flash * 0.6})`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 易主闪光（环形扩散）
  if (c.captureFlash > 0) {
    const cr = r + (1 - c.captureFlash) * 30;
    ctx.strokeStyle = `rgba(255,255,255,${c.captureFlash})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, cr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 兵力数值：己方城池显示数字，敌方/中立显示 ?（刺探有效期内显示数字）
  const showTroops = c.owner === 'player' || isCitySpied(state, c.id);
  const fontSize = c.size === 'large' ? 19 : c.size === 'medium' ? 17 : 15;
  ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = col.main;
  ctx.fillText(showTroops ? String(Math.floor(c.troops)) : '?', c.x, c.y + 1);

  // 城市名（下方）
  ctx.font = '500 10px "Share Tech Mono", "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(180,190,200,0.7)';
  ctx.fillText(c.name, c.x, c.y + r + 13);

  // 产出标识：资源城市显示资源图标+数量，军事城市显示◆兵
  ctx.font = '600 9px "JetBrains Mono", monospace';
  if (isResource) {
    const meta = RESOURCE_META[c.product];
    const amount = Math.floor(c.resources[c.product]);
    const alpha = c.owner === 'neutral' ? 0.5 : 0.9;
    ctx.fillStyle = c.owner === 'neutral'
      ? `rgba(180,180,180,${alpha})`
      : meta.color;
    ctx.fillText(`${meta.icon} ${amount}`, c.x, c.y + r + 24);
  } else {
    ctx.fillStyle = c.owner === 'neutral' ? 'rgba(180,150,120,0.5)' : 'rgba(230,140,70,0.85)';
    ctx.fillText('◆ 军事', c.x, c.y + r + 24);
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  valid: boolean,
  fromRadius: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const col = valid ? '#e8b04b' : '#5a6470';
  // 主线渐变
  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  grad.addColorStop(0, valid ? 'rgba(232,176,75,0.2)' : 'rgba(90,100,112,0.15)');
  grad.addColorStop(1, col);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1 + ux * fromRadius, y1 + uy * fromRadius);
  ctx.lineTo(x2 - ux * 10, y2 - uy * 10);
  ctx.stroke();

  // 箭头尖端
  const ang = Math.atan2(dy, dx);
  const size = 12;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - size * Math.cos(ang - Math.PI / 6),
    y2 - size * Math.sin(ang - Math.PI / 6),
  );
  ctx.lineTo(
    x2 - size * Math.cos(ang + Math.PI / 6),
    y2 - size * Math.sin(ang + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}
