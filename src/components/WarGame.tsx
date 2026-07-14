import { useEffect, useRef, useState } from 'react';
import { MAP_HEIGHT, MAP_WIDTH } from '@/game/map';
import { computeStats, createGameState, fitCamera, resizeCamera, resetGame, update } from '@/game/engine';
import { render } from '@/game/render';
import { bindInput } from '@/game/input';
import type { GameState, GameStats } from '@/game/types';
import Hud from './Hud';
import ResultPanel from './ResultPanel';
import CityInfoPanel from './CityInfoPanel';

export default function WarGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState>(createGameState());
  const [stats, setStats] = useState<GameStats>(() => computeStats(stateRef.current));
  const [status, setStatus] = useState(stateRef.current.status);
  const [elapsed, setElapsed] = useState(0);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const lastSelected = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let initialized = false;

    // 自适应容器尺寸：画布填满容器，分辨率随容器 × dpr 变化
    const resize = () => {
      const cw = container.clientWidth > 0 ? container.clientWidth : MAP_WIDTH;
      const ch = container.clientHeight > 0 ? container.clientHeight : MAP_HEIGHT;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const state = stateRef.current;
      if (!initialized) {
        // 首次：整张地图铺满视口
        fitCamera(state, cw, ch);
        initialized = true;
      } else {
        // 后续：保留当前缩放与视角，仅重新约束范围
        resizeCamera(state, cw, ch);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // 主循环
    let raf = 0;
    let last = performance.now();
    let statsAccum = 0;
    const loop = (now: number) => {
      const dt = Math.min(50, now - last); // 防止后台切回大跳
      last = now;
      const state = stateRef.current;
      update(state, dt);
      render(ctx, state, now / 1000);

      // 节流同步 React 状态（约 6 次/秒）
      statsAccum += dt;
      if (statsAccum >= 160) {
        statsAccum = 0;
        setStats(computeStats(state));
        setElapsed(state.elapsedMs);
        if (state.status !== status) setStatus(state.status);
        if (state.selectedCityId !== lastSelected.current) {
          lastSelected.current = state.selectedCityId;
          setSelectedCityId(state.selectedCityId);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // 输入绑定
    const unbind = bindInput(canvas, () => stateRef.current, {
      onSelect: () => {},
      onDispatch: () => {
        setStats(computeStats(stateRef.current));
      },
    });

    return () => {
      cancelAnimationFrame(raf);
      unbind();
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestart = () => {
    stateRef.current = resetGame();
    const cw = containerRef.current?.clientWidth || MAP_WIDTH;
    const ch = containerRef.current?.clientHeight || MAP_HEIGHT;
    fitCamera(stateRef.current, cw, ch);
    setStats(computeStats(stateRef.current));
    setElapsed(0);
    setStatus('playing');
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      <Hud stats={stats} elapsed={elapsed} status={status} onRestart={handleRestart} />
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="block touch-none"
          style={{ cursor: 'crosshair', imageRendering: 'pixelated', width: '100%', height: '100%' }}
        />
        {/* 左下角操作提示 */}
        <div className="pointer-events-none absolute bottom-3 left-3 select-none font-mono text-[11px] leading-relaxed text-slate-400/70">
          <div className="mb-1 tracking-[0.3em] text-amber-400/60">OPERATION</div>
          <div>拖拽己方城市至相邻目标 — 派遣 50% 兵力</div>
          <div>拖动空白处移动地图 · 双指/滚轮缩放</div>
          <div>军事城产兵 · 资源城产 铁/木/石/粮 · 大城更强</div>
          <div>消灭所有敌方城市即获胜</div>
        </div>
        {/* 城市属性面板 */}
        <CityInfoPanel
          city={selectedCityId !== null ? stateRef.current.cities[selectedCityId] ?? null : null}
        />
        {status !== 'playing' && (
          <ResultPanel status={status} stats={stats} elapsed={elapsed} onRestart={handleRestart} />
        )}
      </div>
    </div>
  );
}
