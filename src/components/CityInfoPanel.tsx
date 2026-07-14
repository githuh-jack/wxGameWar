import type { City, ResourceType } from '@/game/types';

interface Props {
  city: City | null;
}

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

export default function CityInfoPanel({ city }: Props) {
  if (!city) return null;
  const o = OWNER_LABEL[city.owner];
  const isTroops = city.product === 'troops';
  const troopPct = Math.round((city.troops / city.maxTroops) * 100);

  return (
    <div className="pointer-events-none absolute right-4 top-4 w-64 select-none rounded-md border border-slate-700/50 bg-[#0a0e14]/85 p-3.5 font-mono text-slate-200 shadow-2xl backdrop-blur-md">
      {/* 标题 */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-bold tracking-wider">{city.name}</span>
        <span className={`text-[9px] tracking-[0.2em] ${o.cls}`}>{o.label}</span>
      </div>

      {/* 规模 + 产出标签 */}
      <div className="mb-3 flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-sm ${isTroops ? 'bg-orange-500' : 'bg-amber-400'}`} />
        <span className="text-[10px] tracking-[0.2em] text-slate-400">
          {SIZE_LABEL[city.size]}
        </span>
      </div>

      {/* 兵力 */}
      <div className="mb-2.5">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[9px] tracking-[0.2em] text-slate-500">兵力 TROOPS</span>
          <span className="text-xs tabular-nums">
            <span className="font-bold text-slate-100">{Math.floor(city.troops)}</span>
            <span className="text-slate-600"> / {city.maxTroops}</span>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-orange-500/80 transition-all duration-300"
            style={{ width: `${troopPct}%` }}
          />
        </div>
        <div className="mt-0.5 text-[8px] tracking-widest text-slate-600">
          {isTroops ? `产出 +${city.growthRate.toFixed(1)}/s` : `缓慢恢复 +${(city.growthRate * 0.35).toFixed(1)}/s`}
        </div>
      </div>

      {/* 产出类型 */}
      <div className="mb-2 border-t border-slate-700/40 pt-2">
        <span className="text-[8px] tracking-[0.2em] text-slate-600">产出 PRODUCTION</span>
        <div className="mt-0.5 text-[11px] tracking-wider text-slate-300">
          {isTroops ? '◆ 兵力 · MILITARY' : `◈ ${RESOURCE_META[city.product].label}`}
        </div>
      </div>

      {/* 物资储备 */}
      <div className="space-y-1.5">
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

      {/* 邻接 */}
      <div className="mt-3 border-t border-slate-700/40 pt-2">
        <span className="text-[8px] tracking-[0.2em] text-slate-600">
          相邻 {city.neighbors.length} 城 · 可出征方向
        </span>
      </div>
    </div>
  );
}
