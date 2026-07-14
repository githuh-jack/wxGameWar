import type { GameStats, GameStatus, Resources } from '@/game/types';

interface HudProps {
  stats: GameStats;
  elapsed: number;
  status: GameStatus;
  onRestart: () => void;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function Hud({ stats, elapsed, status, onRestart }: HudProps) {
  const total = stats.totalCities || 1;
  const playerPct = Math.round((stats.playerCities / total) * 100);
  const enemyPct = Math.round((stats.enemyCities / total) * 100);

  return (
    <header className="relative z-10 flex h-16 items-center justify-between border-b border-amber-500/10 bg-[#0a0e14]/80 px-6 backdrop-blur-sm">
      {/* 左：玩家阵营 */}
      <SideStat
        label="FRIENDLY"
        name="琥珀联军"
        cities={stats.playerCities}
        troops={stats.playerTroops}
        resources={stats.playerResources}
        color="amber"
        align="left"
      />

      {/* 中：进度条 + 计时 */}
      <div className="flex min-w-[280px] flex-col items-center gap-1.5">
        <div className="font-mono text-[10px] tracking-[0.4em] text-slate-500">
          TACTICAL THEATRE · {formatTime(elapsed)}
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
          <div
            className="absolute left-0 top-0 h-full bg-amber-400/80 transition-all duration-300"
            style={{ width: `${playerPct}%` }}
          />
          <div
            className="absolute right-0 top-0 h-full bg-red-500/80 transition-all duration-300"
            style={{ width: `${enemyPct}%` }}
          />
        </div>
        <div className="flex w-full justify-between font-mono text-[9px] tracking-widest text-slate-600">
          <span>{playerPct}%</span>
          <span className="text-slate-700">CONTROL</span>
          <span>{enemyPct}%</span>
        </div>
      </div>

      {/* 右：敌方阵营 + 重启 */}
      <div className="flex items-center gap-4">
        <SideStat
          label="HOSTILE"
          name="猩红军团"
          cities={stats.enemyCities}
          troops={stats.enemyTroops}
          resources={stats.enemyResources}
          color="red"
          align="right"
        />
        <button
          onClick={onRestart}
          disabled={status === 'playing' && elapsed > 0 && stats.playerCities > 0 && stats.enemyCities > 0}
          className="group flex items-center gap-1.5 rounded border border-slate-700/60 bg-slate-900/60 px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] text-slate-400 transition-colors hover:border-amber-500/40 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-slate-700/60 disabled:hover:text-slate-400"
          title="重新开战"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400/70 group-hover:bg-amber-300" />
          RESTART
        </button>
      </div>
    </header>
  );
}

interface SideStatProps {
  label: string;
  name: string;
  cities: number;
  troops: number;
  resources: Resources;
  color: 'amber' | 'red';
  align: 'left' | 'right';
}

const RES_ITEMS: { key: keyof Resources; tag: string; cls: string }[] = [
  { key: 'iron', tag: '铁', cls: 'text-slate-300' },
  { key: 'wood', tag: '木', cls: 'text-green-400' },
  { key: 'stone', tag: '石', cls: 'text-amber-200' },
  { key: 'food', tag: '粮', cls: 'text-yellow-400' },
];

function SideStat({ label, name, cities, troops, resources, color, align }: SideStatProps) {
  const colorClasses =
    color === 'amber'
      ? { text: 'text-amber-400', dim: 'text-amber-500/50', dot: 'bg-amber-400' }
      : { text: 'text-red-500', dim: 'text-red-500/50', dot: 'bg-red-500' };
  const isRight = align === 'right';
  return (
    <div className={`flex items-center gap-3 ${isRight ? 'flex-row-reverse text-right' : ''}`}>
      <div className={`flex flex-col ${isRight ? 'items-end' : 'items-start'}`}>
        <span className="font-mono text-[9px] tracking-[0.35em] text-slate-600">{label}</span>
        <span className={`font-mono text-[11px] tracking-[0.2em] ${colorClasses.dim}`}>{name}</span>
      </div>
      <div className={`flex items-baseline gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
        <div className="flex flex-col items-center">
          <span className={`font-mono text-2xl font-bold tabular-nums leading-none ${colorClasses.text}`}>
            {cities}
          </span>
          <span className="font-mono text-[8px] tracking-[0.2em] text-slate-600">CITY</span>
        </div>
        <span className="font-mono text-slate-700">/</span>
        <div className="flex flex-col items-center">
          <span className={`font-mono text-base font-semibold tabular-nums leading-none ${colorClasses.dim}`}>
            {troops}
          </span>
          <span className="font-mono text-[8px] tracking-[0.2em] text-slate-600">TROOP</span>
        </div>
        <span className="font-mono text-slate-700">/</span>
        {/* 四种物资紧凑展示 */}
        <div className={`flex flex-col items-center gap-0.5 ${isRight ? 'items-end' : 'items-start'}`}>
          <div className={`flex gap-1.5 font-mono text-[10px] tabular-nums leading-none ${isRight ? 'flex-row-reverse' : ''}`}>
            {RES_ITEMS.map((ri) => (
              <span key={ri.key} className={ri.cls}>
                {ri.tag}{resources[ri.key]}
              </span>
            ))}
          </div>
          <span className="font-mono text-[8px] tracking-[0.2em] text-slate-600">STOCK</span>
        </div>
      </div>
      <span className={`h-8 w-px ${color === 'amber' ? 'bg-amber-500/20' : 'bg-red-500/20'}`} />
    </div>
  );
}
