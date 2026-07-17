import type { Army, City } from '@/game/types';

interface Props {
  army: Army | null;
  fromCity: City | null;
  toCity: City | null;
  redirectMode: boolean;
  onToggleCamp: () => void;
  onRetreat: () => void;
  onRedirect: () => void;
}

export default function ArmyPanel({
  army, fromCity, toCity, redirectMode, onToggleCamp, onRetreat, onRedirect,
}: Props) {
  if (!army || !fromCity || !toCity) return null;
  const aliveCount = army.soldiers.filter((s) => s.alive).length;

  return (
    <div className="pointer-events-none absolute left-3 right-3 top-3 rounded-md border border-amber-700/40 bg-[#0a0e14]/90 p-3 font-mono text-slate-200 shadow-2xl backdrop-blur-md sm:left-auto sm:right-4 sm:top-4 sm:w-64">
      {/* 标题 */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-bold tracking-wider">行军部队</span>
        <span className="text-[9px] tracking-[0.2em] text-amber-400">己方 · ARMY</span>
      </div>

      {/* 路线 */}
      <div className="mb-2 text-[11px] tracking-wider text-slate-300">
        {fromCity.name} <span className="text-slate-600">→</span> {toCity.name}
      </div>

      {/* 兵力 */}
      <div className="mb-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[9px] tracking-[0.2em] text-slate-500">兵力 TROOPS</span>
          <span className="text-xs tabular-nums">
            <span className="font-bold text-slate-100">{Math.floor(army.count)}</span>
            <span className="text-slate-600"> · {aliveCount} 像素</span>
          </span>
        </div>
      </div>

      {/* 状态 */}
      <div className="mb-2 border-t border-slate-700/40 pt-2">
        <div className="flex items-center gap-2 text-[10px] tracking-wider">
          {army.camped ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-yellow-400">驻扎中 · CAMPED</span>
            </>
          ) : army.inCombat ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              <span className="text-red-400">交战中 · COMBAT</span>
            </>
          ) : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-amber-400">行军中 · MARCHING</span>
            </>
          )}
        </div>
      </div>

      {/* 驻扎/继续按钮 */}
      <button
        onClick={onToggleCamp}
        className={`pointer-events-auto w-full rounded border px-2 py-2 text-[11px] tracking-[0.15em] transition-colors ${
          army.camped
            ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:border-amber-400/70 hover:bg-amber-500/25'
            : 'border-yellow-700/40 bg-yellow-900/20 text-yellow-400 hover:border-yellow-500/60 hover:bg-yellow-800/30'
        }`}
      >
        {army.camped ? '继续行军 · RESUME' : '驻扎待命 · CAMP'}
      </button>

      {/* 驻扎时额外操作：撤退 + 改道 */}
      {army.camped && (
        <div className="pointer-events-auto mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={onRetreat}
            className="rounded border border-red-700/40 bg-red-900/20 px-2 py-2 text-[11px] tracking-[0.15em] text-red-400 transition-colors hover:border-red-500/60 hover:bg-red-800/30"
          >
            撤退 · RETREAT
          </button>
          <button
            onClick={onRedirect}
            disabled={redirectMode}
            className={`rounded border px-2 py-2 text-[11px] tracking-[0.15em] transition-colors ${
              redirectMode
                ? 'border-blue-400/50 bg-blue-400/10 text-blue-300'
                : 'border-blue-700/40 bg-blue-900/20 text-blue-400 hover:border-blue-500/60 hover:bg-blue-800/30'
            }`}
          >
            {redirectMode ? '● 点城改道' : '改道 · REDIRECT'}
          </button>
        </div>
      )}

      {/* 改道提示 */}
      {redirectMode && (
        <div className="mt-2 rounded border border-blue-700/40 bg-blue-900/20 px-2 py-1.5 text-center text-[10px] tracking-wider text-blue-400">
          点击地图上任意城市改道
        </div>
      )}
    </div>
  );
}
