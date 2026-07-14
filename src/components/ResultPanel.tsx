import type { GameStats, GameStatus } from '@/game/types';

interface ResultPanelProps {
  status: GameStatus;
  stats: GameStats;
  elapsed: number;
  onRestart: () => void;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function ResultPanel({ status, stats, elapsed, onRestart }: ResultPanelProps) {
  const won = status === 'won';
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-[3px]">
      <div
        className={`relative w-[360px] overflow-hidden rounded-lg border bg-[#0b1018]/95 p-7 shadow-2xl ${
          won ? 'border-amber-500/40' : 'border-red-500/40'
        }`}
      >
        {/* 顶部装饰条 */}
        <div
          className={`absolute inset-x-0 top-0 h-px ${won ? 'bg-gradient-to-r from-transparent via-amber-400 to-transparent' : 'bg-gradient-to-r from-transparent via-red-500 to-transparent'}`}
        />
        {/* 角标 */}
        <div className="mb-5 flex items-center justify-between font-mono text-[9px] tracking-[0.4em] text-slate-600">
          <span>SITREP · TERMINAL</span>
          <span className={won ? 'text-amber-400/70' : 'text-red-500/70'}>{won ? '0x00' : '0x01'}</span>
        </div>

        <h2
          className={`mb-1 font-mono text-3xl font-bold tracking-[0.2em] ${won ? 'text-amber-300' : 'text-red-400'}`}
        >
          {won ? 'VICTORY' : 'DEFEATED'}
        </h2>
        <p className="mb-6 font-mono text-[11px] tracking-wider text-slate-500">
          {won ? '所有敌对势力已被肃清，领土光复。' : '己方城市尽数沦陷，作战失败。'}
        </p>

        {/* 统计 */}
        <div className="mb-6 space-y-2 font-mono text-[11px]">
          <Row label="对局时长" value={formatTime(elapsed)} />
          <Row label="己方占领" value={`${stats.playerCities} / ${stats.totalCities}`} />
          <Row label="己方残部" value={String(stats.playerTroops)} />
          <Row label="敌方残部" value={String(stats.enemyTroops)} />
        </div>

        <button
          onClick={onRestart}
          className={`group relative w-full overflow-hidden rounded border py-2.5 font-mono text-[11px] tracking-[0.3em] transition-all ${
            won
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:shadow-[0_0_20px_rgba(232,176,75,0.3)]'
              : 'border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:shadow-[0_0_20px_rgba(216,58,58,0.3)]'
          }`}
        >
          <span className="relative z-10">REDEPLOY · 再战一局</span>
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
      <span className="tracking-[0.2em] text-slate-600">{label}</span>
      <span className="tabular-nums text-slate-300">{value}</span>
    </div>
  );
}
