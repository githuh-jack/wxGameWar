import type { City, ResourceType } from '@/game/types';

interface Props {
  city: City | null;
  dispatchRatio: number;
  buildRoadFrom: number | null;
  isSpied: boolean;
  onSetDispatchRatio: (r: number) => void;
  onBuildRoad: () => void;
  onSpy: () => void;
  onEnterCity: () => void;
}

const RATIOS = [0.25, 0.5, 0.75, 1.0];

const OWNER_LABEL: Record<string, { label: string; cls: string }> = {
  player: { label: '己方 · AMBER', cls: 'text-amber-400' },
  enemy: { label: '敌方 · CRIMSON', cls: 'text-red-500' },
  neutral: { label: '中立 · NEUTRAL', cls: 'text-slate-400' },
};

const SIZE_LABEL: Record<string, string> = {
  small: '小城 · SMALL',
  medium: '中城 · MEDIUM',
  large: '大城 · LARGE',
};

const RESOURCE_META: Record<ResourceType, { label: string; cls: string; bar: string }> = {
  iron: { label: '铁矿 IRON', cls: 'text-slate-300', bar: 'bg-slate-400/80' },
  wood: { label: '木头 WOOD', cls: 'text-green-400', bar: 'bg-green-500/80' },
  stone: { label: '石头 STONE', cls: 'text-amber-200', bar: 'bg-amber-300/80' },
  food: { label: '粮食 FOOD', cls: 'text-yellow-400', bar: 'bg-yellow-500/80' },
};

export default function CityInfoPanel({
  city, dispatchRatio, buildRoadFrom, isSpied, onSetDispatchRatio, onBuildRoad, onSpy, onEnterCity,
}: Props) {
  if (!city) return null;
  const o = OWNER_LABEL[city.owner];
  const isTroops = city.product === 'troops';
  const isPlayer = city.owner === 'player';
  const inBuildMode = buildRoadFrom !== null;
  // 非己方城池：未刺探时隐藏兵力
  const showTroops = isPlayer || isSpied;
  const troopText = showTroops ? String(Math.floor(city.troops)) : '?';
  const troopPct = showTroops ? Math.round((city.troops / city.maxTroops) * 100) : 0;

  return (
    <div className="pointer-events-none absolute left-3 right-3 top-3 max-h-[55vh] overflow-y-auto rounded-md border border-slate-700/50 bg-[#0a0e14]/90 p-3 font-mono text-slate-200 shadow-2xl backdrop-blur-md sm:left-auto sm:right-4 sm:top-4 sm:w-64 sm:max-h-none">
      {/* 标题 */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-bold tracking-wider">{city.name}</span>
        <span className={`text-[9px] tracking-[0.2em] ${o.cls}`}>{o.label}</span>
      </div>

      {/* 规模 + 产出标签 */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-sm ${isTroops ? 'bg-orange-500' : 'bg-amber-400'}`} />
        <span className="text-[10px] tracking-[0.2em] text-slate-400">
          {SIZE_LABEL[city.size]}
        </span>
      </div>

      {/* 兵力 */}
      <div className="mb-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[9px] tracking-[0.2em] text-slate-500">兵力 TROOPS</span>
          <span className="text-xs tabular-nums">
            <span className="font-bold text-slate-100">{troopText}</span>
            {showTroops && <span className="text-slate-600"> / {city.maxTroops}</span>}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-orange-500/80 transition-all duration-300"
            style={{ width: `${troopPct}%` }}
          />
        </div>
      </div>

      {/* 产出类型 */}
      <div className="mb-2 border-t border-slate-700/40 pt-1.5">
        <span className="text-[8px] tracking-[0.2em] text-slate-600">产出 PRODUCTION</span>
        <div className="mt-0.5 text-[11px] tracking-wider text-slate-300">
          {isTroops ? '◆ 兵力 · MILITARY' : `◈ ${RESOURCE_META[city.product].label}`}
        </div>
      </div>

      {/* 物资储备（仅己方可见） */}
      {isPlayer && (
        <div className="space-y-1">
          <span className="text-[8px] tracking-[0.2em] text-slate-600">物资 STOCKPILE</span>
          {(['iron', 'wood', 'stone', 'food'] as ResourceType[]).map((rt) => {
            const meta = RESOURCE_META[rt];
            const val = Math.floor(city.resources[rt]);
            const pct = city.maxResource > 0 ? Math.round((val / city.maxResource) * 100) : 0;
            const producing = city.product === rt;
            return (
              <div key={rt}>
                <div className="flex items-baseline justify-between">
                  <span className={`text-[9px] tracking-[0.15em] ${meta.cls} ${producing ? '' : 'opacity-60'}`}>
                    {meta.label}
                  </span>
                  <span className="text-[10px] tabular-nums text-slate-400">
                    {val}<span className="text-slate-600"> / {city.maxResource}</span>
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full ${meta.bar} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 邻接 */}
      <div className="mt-2 border-t border-slate-700/40 pt-1.5">
        <span className="text-[8px] tracking-[0.2em] text-slate-600">
          相邻 {city.neighbors.length} 城 · 可出征方向
        </span>
      </div>

      {/* 己方城市操作：出兵比例 + 建造道路 */}
      {isPlayer && (
        <div className="mt-2 space-y-2 border-t border-slate-700/40 pt-2">
          {/* 出兵比例 */}
          <div>
            <span className="text-[8px] tracking-[0.2em] text-slate-600">出兵比例 RATIO</span>
            <div className="pointer-events-auto mt-1 flex gap-1">
              {RATIOS.map((r) => (
                <button
                  key={r}
                  onClick={() => onSetDispatchRatio(r)}
                  className={`flex-1 rounded border px-1 py-1.5 text-[11px] tracking-wider transition-colors ${
                    Math.abs(dispatchRatio - r) < 0.01
                      ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                      : 'border-slate-700/50 bg-slate-900/40 text-slate-400 hover:border-amber-500/30 hover:text-amber-400'
                  }`}
                >
                  {Math.round(r * 100)}%
                </button>
              ))}
            </div>
          </div>
          {/* 建造道路 */}
          <div className="pointer-events-auto">
            <button
              onClick={onBuildRoad}
              disabled={inBuildMode}
              className={`w-full rounded border px-2 py-2 text-[11px] tracking-[0.15em] transition-colors ${
                inBuildMode
                  ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                  : 'border-green-700/40 bg-green-900/20 text-green-400 hover:border-green-500/60 hover:bg-green-800/30'
              }`}
            >
              {inBuildMode ? '● 点击另一己方城市建路' : '建造道路 · 木30 石20'}
            </button>
          </div>
          {/* 进入城内 */}
          <div className="pointer-events-auto">
            <button
              onClick={onEnterCity}
              className="w-full rounded border border-amber-600/40 bg-amber-900/20 px-2 py-2 text-[11px] tracking-[0.15em] text-amber-300 transition-colors hover:border-amber-400/60 hover:bg-amber-800/30"
            >
              进入城内 · 内政建设
            </button>
          </div>
        </div>
      )}

      {/* 非己方城池：刺探按钮 */}
      {!isPlayer && (
        <div className="pointer-events-auto mt-2 border-t border-slate-700/40 pt-2">
          {isSpied ? (
            <div className="rounded border border-cyan-700/40 bg-cyan-900/20 px-2 py-2 text-center text-[11px] tracking-[0.15em] text-cyan-400">
              ● 已刺探 · 兵力可见
            </div>
          ) : (
            <button
              onClick={onSpy}
              className="w-full rounded border border-cyan-700/40 bg-cyan-900/20 px-2 py-2 text-[11px] tracking-[0.15em] text-cyan-400 transition-colors hover:border-cyan-500/60 hover:bg-cyan-800/30"
            >
              刺探兵力 · 消耗粮10
            </button>
          )}
        </div>
      )}
    </div>
  );
}
