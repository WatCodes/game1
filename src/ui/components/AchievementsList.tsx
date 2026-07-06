import { useGame } from '../../store/gameStore';

export function AchievementsList() {
  const achievements = useGame((s) => s.display.achievements);
  const mult = useGame((s) => s.display.achievementMult);
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <div className="rounded border border-line bg-panel/60 p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] uppercase tracking-widest text-ink-dim">Records</h3>
        <span className="font-mono text-[11px] text-ink-dim">
          {earned}/{achievements.length} · output <span className="text-volt">×{mult.toFixed(2)}</span>
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`rounded border px-2 py-1.5 ${
              a.earned ? 'border-volt-dim bg-raised/40' : 'striped border-line opacity-60'
            }`}
          >
            <div className={`text-xs font-semibold ${a.earned ? 'text-volt' : 'text-ink-dim'}`}>
              {a.earned ? '🏆 ' : ''}{a.name}
            </div>
            <div className="text-[10px] leading-tight text-ink-dim">{a.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
