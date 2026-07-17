import { useEffect, useRef, useState } from 'react';
import type { BuildingType, City, CityTileType, ResourceType } from '@/game/types';
import { BUILDING_META, BUILDING_TYPES } from '@/game/engine';
import {
  CITY_TILE_SIZE, CITY_TILE_META, canPlaceBuilding, cityTileDim, getCityTilesWithRoads,
} from '@/game/map';

interface Props {
  city: City;
  onBuild: (type: BuildingType, tx: number, ty: number) => void;
  onBuildRoad: (tx: number, ty: number) => void;
  onClose: () => void;
}

const RESOURCE_LABEL: Record<ResourceType, string> = {
  iron: '铁', wood: '木', stone: '石', food: '粮',
};

function moraleColor(m: number): string {
  if (m >= 50) return 'bg-green-500/80';
  if (m >= 30) return 'bg-yellow-500/80';
  return 'bg-red-500/80';
}

function moraleText(m: number): string {
  if (m >= 70) return '安定';
  if (m >= 50) return '平稳';
  if (m >= 30) return '动荡';
  if (m >= 15) return '危机';
  return '叛乱';
}

type PlaceMode = BuildingType | 'road' | null;

export default function CityView({ city, onBuild, onBuildRoad, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef({ x: 0, y: 0, scale: 1, minScale: 0.5 });
  const dragRef = useRef({
    active: false, moved: false, sx: 0, sy: 0, cx: 0, cy: 0,
  });
  const placeModeRef = useRef<PlaceMode>(null);
  const hoverTileRef = useRef<{ x: number; y: number } | null>(null);
  const cityRef = useRef(city);
  cityRef.current = city;

  const [placeMode, setPlaceMode] = useState<PlaceMode>(null);
  const [showOverview, setShowOverview] = useState(false);

  const dim = cityTileDim(city.size);
  const worldPx = dim * CITY_TILE_SIZE;

  // 地块缓存：道路变化时重新生成
  const tilesRef = useRef<CityTileType[][]>([]);
  const lastRoadCountRef = useRef(-1);

  useEffect(() => { placeModeRef.current = placeMode; }, [placeMode]);

  const refreshTiles = () => {
    tilesRef.current = getCityTilesWithRoads(cityRef.current);
    lastRoadCountRef.current = cityRef.current.roads.length;
  };

  const fitCamera = () => {
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scale = Math.min(cw / worldPx, ch / worldPx) * 0.9;
    const minScale = scale;
    cameraRef.current = {
      x: (worldPx - cw / scale) / 2,
      y: (worldPx - ch / scale) / 2,
      scale,
      minScale,
    };
  };

  const clampCamera = () => {
    const cam = cameraRef.current;
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const maxX = Math.max(0, worldPx - cw / cam.scale);
    const maxY = Math.max(0, worldPx - ch / cam.scale);
    cam.x = Math.max(0, Math.min(maxX, cam.x));
    cam.y = Math.max(0, Math.min(maxY, cam.y));
  };

  // 渲染循环
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    refreshTiles();
    fitCamera();

    let raf = 0;
    const render = () => {
      const c = cityRef.current;
      // 道路变化时刷新地块
      if (c.roads.length !== lastRoadCountRef.current) refreshTiles();
      const tiles = tilesRef.current;
      const cam = cameraRef.current;
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      ctx.fillStyle = '#070a0e';
      ctx.fillRect(0, 0, cw, ch);

      const tileSize = CITY_TILE_SIZE * cam.scale;
      const startX = Math.max(0, Math.floor(cam.x / CITY_TILE_SIZE));
      const startY = Math.max(0, Math.floor(cam.y / CITY_TILE_SIZE));
      const endX = Math.min(dim, Math.ceil((cam.x + cw / cam.scale) / CITY_TILE_SIZE));
      const endY = Math.min(dim, Math.ceil((cam.y + ch / cam.scale) / CITY_TILE_SIZE));

      // 绘制地块
      for (let ty = startY; ty < endY; ty++) {
        for (let tx = startX; tx < endX; tx++) {
          const tile = tiles[ty][tx];
          const meta = CITY_TILE_META[tile];
          const sx = (tx * CITY_TILE_SIZE - cam.x) * cam.scale;
          const sy = (ty * CITY_TILE_SIZE - cam.y) * cam.scale;
          ctx.fillStyle = meta.color;
          ctx.fillRect(sx, sy, tileSize + 1, tileSize + 1);
          if (tile === 'tree') {
            ctx.fillStyle = '#0a1808';
            ctx.fillRect(sx + tileSize * 0.3, sy + tileSize * 0.25, tileSize * 0.4, tileSize * 0.5);
          } else if (tile === 'water') {
            ctx.fillStyle = '#1a4050';
            ctx.fillRect(sx + tileSize * 0.15, sy + tileSize * 0.55, tileSize * 0.7, tileSize * 0.15);
          } else if (tile === 'rock') {
            ctx.fillStyle = '#3a3428';
            ctx.fillRect(sx + tileSize * 0.25, sy + tileSize * 0.25, tileSize * 0.5, tileSize * 0.5);
          } else if (tile === 'road') {
            ctx.fillStyle = '#4a4030';
            ctx.fillRect(sx + tileSize * 0.2, sy + tileSize * 0.45, tileSize * 0.6, tileSize * 0.1);
          }
        }
      }

      // 网格线
      if (cam.scale > 0.7) {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let tx = startX; tx <= endX; tx++) {
          const sx = (tx * CITY_TILE_SIZE - cam.x) * cam.scale;
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, ch);
        }
        for (let ty = startY; ty <= endY; ty++) {
          const sy = (ty * CITY_TILE_SIZE - cam.y) * cam.scale;
          ctx.moveTo(0, sy);
          ctx.lineTo(cw, sy);
        }
        ctx.stroke();
      }

      // 绘制建筑（2x2）
      for (const b of c.buildings) {
        if (b.x < 0 || b.y < 0) continue;
        const meta = BUILDING_META[b.type];
        const sx = (b.x * CITY_TILE_SIZE - cam.x) * cam.scale;
        const sy = (b.y * CITY_TILE_SIZE - cam.y) * cam.scale;
        const bw = 2 * tileSize;
        ctx.fillStyle = meta.color;
        ctx.globalAlpha = 0.22;
        ctx.fillRect(sx + 2, sy + 2, bw - 4, bw - 4);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = meta.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 2, sy + 2, bw - 4, bw - 4);
        ctx.fillStyle = meta.color;
        ctx.font = `bold ${Math.floor(bw * 0.35)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(meta.icon, sx + bw / 2, sy + bw * 0.4);
        ctx.font = `${Math.floor(bw * 0.2)}px monospace`;
        ctx.fillStyle = '#ffe080';
        ctx.fillText(`Lv.${b.level}`, sx + bw / 2, sy + bw * 0.75);
      }

      // 绘制文臣武将（中央道路两侧）
      const heroSize = Math.max(14, tileSize * 0.9);
      c.heroes.forEach((h, i) => {
        const cx = dim / 2;
        const cy = dim / 2;
        const side = h.type === 'civil' ? -1 : 1;
        const offset = Math.floor((i + 1) / 2);
        const hx = cx + side * (offset * 2 + 1);
        const hy = cy + (i % 2 === 0 ? -3 : 3);
        const sx = (hx * CITY_TILE_SIZE - cam.x) * cam.scale + tileSize / 2;
        const sy = (hy * CITY_TILE_SIZE - cam.y) * cam.scale + tileSize / 2;
        // 光圈
        const color = h.type === 'civil' ? '#5b9bd5' : '#d9534f';
        ctx.fillStyle = `${color}33`;
        ctx.beginPath();
        ctx.arc(sx, sy, heroSize * 0.7, 0, Math.PI * 2);
        ctx.fill();
        // 圆形底
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, heroSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // 首字
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.floor(heroSize * 0.6)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(h.name[0], sx, sy);
        // 名称（缩放足够大时）
        if (cam.scale > 1.2) {
          ctx.font = `${Math.floor(heroSize * 0.4)}px monospace`;
          ctx.fillStyle = color;
          ctx.fillText(h.name, sx, sy + heroSize * 0.7);
        }
      });

      // 放置预览
      const pm = placeModeRef.current;
      const ht = hoverTileRef.current;
      if (pm && ht) {
        const sx = (ht.x * CITY_TILE_SIZE - cam.x) * cam.scale;
        const sy = (ht.y * CITY_TILE_SIZE - cam.y) * cam.scale;
        if (pm === 'road') {
          // 道路：1x1 预览
          const tile = tiles[ht.y]?.[ht.x];
          const can = tile === 'grass' && !c.buildings.some((b) =>
            b.x >= 0 && ht.x >= b.x && ht.x <= b.x + 1 && ht.y >= b.y && ht.y <= b.y + 1);
          ctx.fillStyle = can ? 'rgba(80,255,80,0.18)' : 'rgba(255,60,60,0.18)';
          ctx.fillRect(sx, sy, tileSize, tileSize);
          ctx.strokeStyle = can ? '#50ff50' : '#ff4040';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(sx, sy, tileSize, tileSize);
          ctx.setLineDash([]);
        } else {
          // 建筑：2x2 预览
          const can = canPlaceBuilding(tiles, c.buildings, ht.x, ht.y);
          const bw = 2 * tileSize;
          ctx.fillStyle = can ? 'rgba(80,255,80,0.18)' : 'rgba(255,60,60,0.18)';
          ctx.fillRect(sx, sy, bw, bw);
          ctx.strokeStyle = can ? '#50ff50' : '#ff4040';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(sx, sy, bw, bw);
          ctx.setLineDash([]);
        }
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dim, worldPx]);

  // ---- 输入 ----
  const onPointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const cam = cameraRef.current;
    dragRef.current = {
      active: true, moved: false,
      sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const cam = cameraRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (drag.active) {
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      cam.x = drag.cx - dx / cam.scale;
      cam.y = drag.cy - dy / cam.scale;
      clampCamera();
    }

    if (placeModeRef.current) {
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wx = cam.x + sx / cam.scale;
      const wy = cam.y + sy / cam.scale;
      const tx = Math.floor(wx / CITY_TILE_SIZE);
      const ty = Math.floor(wy / CITY_TILE_SIZE);
      const maxTx = placeModeRef.current === 'road' ? dim - 1 : dim - 2;
      const maxTy = placeModeRef.current === 'road' ? dim - 1 : dim - 2;
      if (tx >= 0 && tx <= maxTx && ty >= 0 && ty <= maxTy) {
        hoverTileRef.current = { x: tx, y: ty };
      } else {
        hoverTileRef.current = null;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    drag.active = false;
    const canvas = canvasRef.current;
    if (canvas) canvas.releasePointerCapture(e.pointerId);

    if (!drag.moved && placeMode) {
      const cam = cameraRef.current;
      const rect = canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wx = cam.x + sx / cam.scale;
      const wy = cam.y + sy / cam.scale;
      const tx = Math.floor(wx / CITY_TILE_SIZE);
      const ty = Math.floor(wy / CITY_TILE_SIZE);
      if (placeMode === 'road') {
        onBuildRoad(tx, ty);
      } else {
        onBuild(placeMode, tx, ty);
        setPlaceMode(null);
      }
      hoverTileRef.current = null;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const cam = cameraRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wx = cam.x + sx / cam.scale;
    const wy = cam.y + sy / cam.scale;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    cam.scale = Math.max(cam.minScale, Math.min(3.5, cam.scale * factor));
    cam.x = wx - sx / cam.scale;
    cam.y = wy - sy / cam.scale;
    clampCamera();
  };

  // 工具栏点击
  const handleToolbarClick = (mode: PlaceMode) => {
    if (mode === 'road') {
      setPlaceMode(placeMode === 'road' ? null : 'road');
      setShowOverview(false);
      return;
    }
    const type = mode as BuildingType;
    const existing = city.buildings.find((b) => b.type === type);
    if (existing) {
      onBuild(type, existing.x, existing.y);
    } else {
      setPlaceMode(type);
      setShowOverview(false);
    }
  };

  const placeLabel = placeMode === 'road'
    ? '道路'
    : placeMode
    ? BUILDING_META[placeMode].name
    : null;

  const popPct = Math.round((city.population / city.maxPopulation) * 100);
  const troopPct = Math.round((city.troops / city.maxTroops) * 100);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#070a0e]">
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-[#0a0e14] px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-bold tracking-wider text-amber-400">{city.name}</span>
          <span className="font-mono text-[10px] tracking-[0.2em] text-slate-500">
            {city.size === 'large' ? '大城' : city.size === 'medium' ? '中城' : '小城'} · 城内地图
          </span>
          {placeLabel && (
            <span className="rounded bg-amber-400/15 px-2 py-0.5 font-mono text-[10px] tracking-wider text-amber-300">
              ● 放置中：{placeLabel} — 点击放置 / 右键取消
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOverview(true)}
            className="rounded border border-slate-600/50 bg-slate-800/60 px-3 py-1.5 font-mono text-xs tracking-wider text-slate-300 transition-colors hover:border-sky-500/50 hover:text-sky-400"
          >
            概览
          </button>
          <button
            onClick={onClose}
            className="rounded border border-slate-600/50 bg-slate-800/60 px-3 py-1.5 font-mono text-xs tracking-wider text-slate-300 transition-colors hover:border-red-500/50 hover:text-red-400"
          >
            ✕ 关闭
          </button>
        </div>
      </div>

      {/* 地图区 */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block touch-none"
          style={{ cursor: placeMode ? 'crosshair' : 'grab', width: '100%', height: '100%' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          onContextMenu={(e) => {
            e.preventDefault();
            if (placeMode) {
              setPlaceMode(null);
              hoverTileRef.current = null;
            }
          }}
        />
        <div className="pointer-events-none absolute bottom-2 left-3 select-none font-mono text-[10px] leading-relaxed text-slate-500/70">
          拖拽移动 · 滚轮缩放
          {placeMode && ' · 点击放置'}
        </div>
        {/* 图例 */}
        <div className="pointer-events-none absolute bottom-2 right-3 select-none font-mono text-[10px] text-slate-500/70">
          <span className="text-[#5b9bd5]">● 文臣</span> <span className="text-[#d9534f]">● 武将</span>
        </div>
      </div>

      {/* 建筑工具栏 */}
      <div className="border-t border-slate-700/50 bg-[#0a0e14] px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {BUILDING_TYPES.map((type) => {
            const meta = BUILDING_META[type];
            const existing = city.buildings.find((b) => b.type === type);
            const lvl = existing ? existing.level : 0;
            const maxed = lvl >= meta.maxLevel;
            const nextCost = {
              gold: meta.cost.gold * (lvl + 1),
              wood: meta.cost.wood * (lvl + 1),
              stone: meta.cost.stone * (lvl + 1),
            };
            const selected = placeMode === type;
            return (
              <button
                key={type}
                onClick={() => handleToolbarClick(type)}
                disabled={maxed}
                className={`flex items-center gap-1.5 rounded border px-2 py-1.5 font-mono text-[10px] tracking-wider transition-colors ${
                  maxed
                    ? 'border-slate-700/40 bg-slate-800/30 text-slate-600'
                    : selected
                    ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                    : 'border-slate-600/40 bg-slate-800/50 text-slate-300 hover:border-amber-500/40 hover:text-amber-400'
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded text-xs font-bold" style={{ color: meta.color, background: `${meta.color}22` }}>
                  {meta.icon}
                </span>
                <span>{meta.name}</span>
                {lvl > 0 && <span className="text-amber-400">Lv.{lvl}</span>}
                {!maxed && (
                  <span className="text-slate-500">
                    {nextCost.gold > 0 && `金${nextCost.gold} `}
                    {nextCost.wood > 0 && `木${nextCost.wood} `}
                    {nextCost.stone > 0 && `石${nextCost.stone}`}
                  </span>
                )}
                {maxed && <span className="text-slate-600">满级</span>}
              </button>
            );
          })}
          {/* 道路工具 */}
          <button
            onClick={() => handleToolbarClick('road')}
            className={`flex items-center gap-1.5 rounded border px-2 py-1.5 font-mono text-[10px] tracking-wider transition-colors ${
              placeMode === 'road'
                ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                : 'border-slate-600/40 bg-slate-800/50 text-slate-300 hover:border-amber-500/40 hover:text-amber-400'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-amber-200" style={{ background: '#4a403033' }}>
              路
            </span>
            <span>道路</span>
            <span className="text-slate-500">石5/tile</span>
          </button>
        </div>
      </div>

      {/* 概览弹窗 */}
      {showOverview && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowOverview(false)}>
          <div className="flex max-h-[88vh] w-[640px] max-w-[94vw] flex-col overflow-hidden rounded-xl border border-slate-700/60 bg-[#0a0e14]/95 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-700/50 px-5 py-3">
              <div>
                <div className="font-mono text-xl font-bold tracking-wider text-amber-400">{city.name}</div>
                <div className="font-mono text-[10px] tracking-[0.25em] text-slate-500">
                  {city.size === 'large' ? '大城 LARGE' : city.size === 'medium' ? '中城 MEDIUM' : '小城 SMALL'} · 城市概览
                </div>
              </div>
              <button onClick={() => setShowOverview(false)} className="rounded border border-slate-600/50 bg-slate-800/60 px-3 py-1.5 font-mono text-xs tracking-wider text-slate-300 transition-colors hover:border-red-500/50 hover:text-red-400">
                ✕ 关闭
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 font-mono">
              {/* 属性网格 */}
              <div className="mb-4">
                <div className="mb-2 text-[10px] tracking-[0.25em] text-slate-600">城市属性 STATS</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded border border-slate-700/40 bg-slate-900/40 px-3 py-2">
                    <div className="text-[9px] tracking-wider text-slate-500">人口 POP</div>
                    <div className="text-sm tabular-nums text-slate-200">{Math.floor(city.population)}<span className="text-slate-600"> / {city.maxPopulation}</span></div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-sky-500/80" style={{ width: `${popPct}%` }} /></div>
                  </div>
                  <div className="rounded border border-slate-700/40 bg-slate-900/40 px-3 py-2">
                    <div className="text-[9px] tracking-wider text-slate-500">兵力 TROOPS</div>
                    <div className="text-sm tabular-nums text-slate-200">{Math.floor(city.troops)}<span className="text-slate-600"> / {city.maxTroops}</span></div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-orange-500/80" style={{ width: `${troopPct}%` }} /></div>
                  </div>
                  <div className="rounded border border-slate-700/40 bg-slate-900/40 px-3 py-2">
                    <div className="text-[9px] tracking-wider text-slate-500">金钱 GOLD</div>
                    <div className="text-sm tabular-nums text-amber-300">{Math.floor(city.gold)}</div>
                  </div>
                  <div className="rounded border border-slate-700/40 bg-slate-900/40 px-3 py-2">
                    <div className="text-[9px] tracking-wider text-slate-500">军械 WEAPONS</div>
                    <div className="text-sm tabular-nums text-slate-300">{Math.floor(city.weapons)}</div>
                    <div className="mt-0.5 text-[8px] text-slate-600">出兵消耗等量·攻击+50%</div>
                  </div>
                  {(['iron', 'wood', 'stone', 'food'] as ResourceType[]).map((rt) => (
                    <div key={rt} className="rounded border border-slate-700/40 bg-slate-900/40 px-3 py-2">
                      <div className="text-[9px] tracking-wider text-slate-500">{RESOURCE_LABEL[rt]} {rt.toUpperCase()}</div>
                      <div className="text-sm tabular-nums text-slate-200">{Math.floor(city.resources[rt])}<span className="text-slate-600"> / {city.maxResource}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              {/* 民心 */}
              <div className="mb-4 rounded border border-slate-700/40 bg-slate-900/40 px-3 py-2">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[9px] tracking-wider text-slate-500">民心 MORALE</span>
                  <span className="text-xs tabular-nums text-slate-200">{Math.floor(city.morale)}<span className="ml-1 text-slate-500">{moraleText(city.morale)}</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full ${moraleColor(city.morale)}`} style={{ width: `${city.morale}%` }} /></div>
                <div className="mt-1 text-[8px] text-slate-600">民心 &lt; 30 可能独立 · &lt; 15 可能投敌</div>
              </div>
              {/* 文臣武将 */}
              {city.heroes.length > 0 && (
                <div className="mb-4">
                  <div className="mb-2 text-[10px] tracking-[0.25em] text-slate-600">文臣武将 HEROES</div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {city.heroes.map((h) => (
                      <div key={h.name} className="flex items-center gap-2 rounded border border-slate-700/40 bg-slate-900/40 px-3 py-1.5">
                        <span className={`flex h-7 w-7 items-center justify-center rounded text-sm font-bold ${h.type === 'civil' ? 'text-[#5b9bd5]' : 'text-[#d9534f]'}`} style={{ background: h.type === 'civil' ? '#5b9bd522' : '#d9534f22' }}>
                          {h.name[0]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] tracking-wider text-slate-200">{h.name}</span>
                            <span className={`text-[8px] tracking-[0.15em] ${h.type === 'civil' ? 'text-[#5b9bd5]' : 'text-[#d9534f]'}`}>{h.type === 'civil' ? '文臣' : '武将'}</span>
                          </div>
                          <div className="text-[9px] text-slate-500">{h.title} · {h.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 建筑列表 */}
              <div>
                <div className="mb-2 text-[10px] tracking-[0.25em] text-slate-600">建筑 BUILDINGS</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {BUILDING_TYPES.map((type) => {
                    const meta = BUILDING_META[type];
                    const existing = city.buildings.find((b) => b.type === type);
                    const lvl = existing ? existing.level : 0;
                    const maxed = lvl >= meta.maxLevel;
                    const nextCost = { gold: meta.cost.gold * (lvl + 1), wood: meta.cost.wood * (lvl + 1), stone: meta.cost.stone * (lvl + 1) };
                    return (
                      <div key={type} className="flex items-center justify-between rounded border border-slate-700/40 bg-slate-900/40 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold" style={{ color: meta.color, background: `${meta.color}22` }}>{meta.icon}</span>
                          <div>
                            <div className="text-[11px] tracking-wider text-slate-200">{meta.name}{lvl > 0 && <span className="ml-1 text-amber-400">Lv.{lvl}</span>}</div>
                            <div className="text-[9px] text-slate-500">{meta.desc}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToolbarClick(type)}
                          disabled={maxed}
                          className={`rounded border px-2 py-1 text-[10px] tracking-wider transition-colors ${maxed ? 'border-slate-700/50 bg-slate-800/40 text-slate-600' : 'border-amber-600/40 bg-amber-900/20 text-amber-300 hover:border-amber-400/60 hover:bg-amber-800/30'}`}
                        >
                          {maxed ? '已满级' : lvl === 0 ? '建造' : '升级'}
                          {!maxed && <span className="ml-1 text-slate-500">{nextCost.gold > 0 && `金${nextCost.gold} `}{nextCost.wood > 0 && `木${nextCost.wood} `}{nextCost.stone > 0 && `石${nextCost.stone}`}</span>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
