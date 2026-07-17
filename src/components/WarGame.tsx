import { useEffect, useRef, useState } from 'react';
import {
  buildBuilding, buildCityRoad, computeStats, createGameState, fitCamera, isCitySpied, resizeCamera,
  resetGame, retreatArmy, spyCity, startGame, toggleCamp, update,
} from '@/game/engine';
import { render } from '@/game/render';
import { bindInput } from '@/game/input';
import type { BuildingType, GameState, GameStats, MapType } from '@/game/types';
import Hud from './Hud';
import ResultPanel from './ResultPanel';
import CityInfoPanel from './CityInfoPanel';
import ArmyPanel from './ArmyPanel';
import CityView from './CityView';

export default function WarGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState>(createGameState());
  const [stats, setStats] = useState<GameStats>(() => computeStats(stateRef.current));
  const [status, setStatus] = useState(stateRef.current.status);
  const [elapsed, setElapsed] = useState(0);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [selectedArmyId, setSelectedArmyId] = useState<number | null>(null);
  const [dispatchRatio, setDispatchRatio] = useState(stateRef.current.dispatchRatio);
  const [buildRoadFrom, setBuildRoadFrom] = useState<number | null>(null);
  const [redirectFromArmyId, setRedirectFromArmyId] = useState<number | null>(null);
  const [cityViewId, setCityViewId] = useState<number | null>(null);
  const lastSelected = useRef<number | null>(null);
  const lastArmy = useRef<number | null>(null);

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
      const cw = container.clientWidth > 0 ? container.clientWidth : stateRef.current.mapW;
      const ch = container.clientHeight > 0 ? container.clientHeight : stateRef.current.mapH;
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
        if (state.selectedArmyId !== lastArmy.current) {
          lastArmy.current = state.selectedArmyId;
          setSelectedArmyId(state.selectedArmyId);
        }
        setBuildRoadFrom(state.buildRoadFrom);
        setRedirectFromArmyId(state.redirectFromArmyId);
        setCityViewId(state.cityViewId);
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
    setStatus('selecting');
    setSelectedCityId(null);
    setSelectedArmyId(null);
    setBuildRoadFrom(null);
    setRedirectFromArmyId(null);
    setCityViewId(null);
  };

  const handleSelectMap = (type: MapType) => {
    stateRef.current = startGame(type);
    const cw = containerRef.current?.clientWidth || stateRef.current.mapW;
    const ch = containerRef.current?.clientHeight || stateRef.current.mapH;
    fitCamera(stateRef.current, cw, ch);
    setStats(computeStats(stateRef.current));
    setElapsed(0);
    setStatus('playing');
    setSelectedCityId(null);
    setSelectedArmyId(null);
    setDispatchRatio(stateRef.current.dispatchRatio);
    setBuildRoadFrom(null);
    setRedirectFromArmyId(null);
    setCityViewId(null);
  };

  const selectedArmy = selectedArmyId !== null
    ? stateRef.current.armies.find((a) => a.id === selectedArmyId) ?? null
    : null;
  const armyFrom = selectedArmy ? stateRef.current.cities[selectedArmy.fromId] ?? null : null;
  const armyTo = selectedArmy ? stateRef.current.cities[selectedArmy.toId] ?? null : null;

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
        {status === 'playing' && (
          <div className="pointer-events-none absolute bottom-3 left-3 select-none font-mono text-[11px] leading-relaxed text-slate-400/70">
            <div className="mb-1 tracking-[0.3em] text-amber-400/60">OPERATION</div>
            <div>拖拽己方城市至相邻目标 — 按设定比例出兵</div>
            <div>点击行军部队可驻扎/继续 · 建路连接己方城市</div>
            <div>拖动空白处移动地图 · 双指/滚轮缩放</div>
            <div>消灭所有敌方城市即获胜</div>
          </div>
        )}
        {/* 城市属性面板（选中城市时） */}
        {status === 'playing' && selectedArmyId === null && (
          <CityInfoPanel
            city={selectedCityId !== null ? stateRef.current.cities[selectedCityId] ?? null : null}
            dispatchRatio={dispatchRatio}
            buildRoadFrom={buildRoadFrom}
            isSpied={selectedCityId !== null ? isCitySpied(stateRef.current, selectedCityId) : false}
            onSetDispatchRatio={(r) => {
              stateRef.current.dispatchRatio = r;
              setDispatchRatio(r);
            }}
            onBuildRoad={() => {
              if (stateRef.current.selectedCityId !== null) {
                stateRef.current.buildRoadFrom = stateRef.current.selectedCityId;
                setBuildRoadFrom(stateRef.current.selectedCityId);
              }
            }}
            onSpy={() => {
              if (selectedCityId !== null) {
                spyCity(stateRef.current, selectedCityId);
                setStats(computeStats(stateRef.current));
              }
            }}
            onEnterCity={() => {
              if (selectedCityId !== null) {
                stateRef.current.cityViewId = selectedCityId;
                setCityViewId(selectedCityId);
              }
            }}
          />
        )}
        {/* 军队面板（选中军队时） */}
        {status === 'playing' && selectedArmyId !== null && (
          <ArmyPanel
            army={selectedArmy}
            fromCity={armyFrom}
            toCity={armyTo}
            redirectMode={redirectFromArmyId !== null}
            onToggleCamp={() => {
              if (selectedArmyId !== null) {
                toggleCamp(stateRef.current, selectedArmyId);
              }
            }}
            onRetreat={() => {
              if (selectedArmyId !== null) {
                retreatArmy(stateRef.current, selectedArmyId);
              }
            }}
            onRedirect={() => {
              if (selectedArmyId !== null) {
                stateRef.current.redirectFromArmyId = selectedArmyId;
                setRedirectFromArmyId(selectedArmyId);
              }
            }}
          />
        )}
        {/* 地图选择界面 */}
        {status === 'selecting' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-[640px] max-w-[90vw] rounded-xl border border-slate-700/50 bg-slate-900/90 p-8 shadow-2xl">
              <h2 className="mb-2 text-center font-mono text-2xl font-bold tracking-widest text-amber-400">
                三国战争
              </h2>
              <p className="mb-6 text-center font-mono text-xs tracking-[0.3em] text-slate-500">
                SELECT CAMPAIGN MAP
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSelectMap('classic')}
                  className="group rounded-lg border border-slate-700 bg-slate-800/60 p-5 text-left transition hover:border-amber-500/50 hover:bg-slate-800"
                >
                  <div className="mb-2 font-mono text-lg font-bold text-slate-200 group-hover:text-amber-400">
                    经典地图
                  </div>
                  <div className="mb-3 font-mono text-[11px] text-slate-500">960 × 600 · 18 城</div>
                  <div className="font-mono text-[11px] leading-relaxed text-slate-400">
                    蜀魏对峙，中原逐鹿<br/>
                    山地、河流、树林交织<br/>
                    紧凑节奏，快速对局
                  </div>
                </button>
                <button
                  onClick={() => handleSelectMap('large')}
                  className="group rounded-lg border border-slate-700 bg-slate-800/60 p-5 text-left transition hover:border-amber-500/50 hover:bg-slate-800"
                >
                  <div className="mb-2 font-mono text-lg font-bold text-slate-200 group-hover:text-amber-400">
                    三国争霸
                  </div>
                  <div className="mb-3 font-mono text-[11px] text-slate-500">1600 × 1000 · 30 城</div>
                  <div className="font-mono text-[11px] leading-relaxed text-slate-400">
                    大地图，含十种地形<br/>
                    长江黄河天险，秦岭屏障<br/>
                    蜀魏中立三十城争霸
                  </div>
                </button>
              </div>
              <div className="mt-6 text-center font-mono text-[10px] tracking-wider text-slate-600">
                地形影响行军速度：草原快 · 山地慢 · 河流最慢
              </div>
            </div>
          </div>
        )}
        {(status === 'won' || status === 'lost') && (
          <ResultPanel status={status} stats={stats} elapsed={elapsed} onRestart={handleRestart} />
        )}
        {/* 城内视图 */}
        {status === 'playing' && cityViewId !== null && stateRef.current.cities[cityViewId] && (
          <CityView
            city={stateRef.current.cities[cityViewId]}
            onBuild={(type: BuildingType, tx: number, ty: number) => {
              buildBuilding(stateRef.current, cityViewId, type, tx, ty);
              setStats(computeStats(stateRef.current));
            }}
            onBuildRoad={(tx: number, ty: number) => {
              buildCityRoad(stateRef.current, cityViewId, tx, ty);
              setStats(computeStats(stateRef.current));
            }}
            onClose={() => {
              stateRef.current.cityViewId = null;
              setCityViewId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
