import WarGame from '@/components/WarGame';

export default function Home() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#070a0f] text-slate-200">
      {/* 顶部标题栏 */}
      <div className="flex h-9 items-center justify-between border-b border-amber-500/10 bg-[#080b11] px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            <span className="font-mono text-[11px] font-bold tracking-[0.5em] text-amber-300">
              GRID·WAR
            </span>
          </div>
          <span className="font-mono text-[9px] tracking-[0.3em] text-slate-600">
            网格战略 · 极简博弈
          </span>
        </div>
        <div className="font-mono text-[9px] tracking-[0.3em] text-slate-600">
          v1.0 · TACTICAL COMMAND
        </div>
      </div>

      {/* 游戏主体 */}
      <div className="flex-1 overflow-hidden">
        <WarGame />
      </div>
    </div>
  );
}
