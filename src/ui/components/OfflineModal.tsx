import { useGame } from '../../store/gameStore';
import { formatPower, formatTime } from '../../engine/format';

export function OfflineModal() {
  const offline = useGame((s) => s.offline);
  const dismissOffline = useGame((s) => s.actions.dismissOffline);

  if (!offline) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded border border-line bg-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">While you were away</h2>
        <p className="mt-2 font-mono text-sm">
          <span className="text-ink-dim">{formatTime(offline.seconds)} elapsed</span>
        </p>
        <p className="mt-1 font-mono text-2xl text-current">+{formatPower(offline.powerGained)}</p>
        {offline.projectGained > 0 && (
          <p className="mt-1 font-mono text-xs text-volt">+{formatPower(offline.projectGained)} routed to construction</p>
        )}
        {offline.puzzlesSolved > 0 && (
          <p className="mt-1 font-mono text-xs text-ink-dim">
            Auto-Solvers finished {offline.puzzlesSolved} circuits: <span className="text-volt">+{offline.creditsGained} CR</span>
          </p>
        )}
        <button
          className="mt-4 w-full rounded border border-current-dim px-3 py-2 text-sm text-current transition-colors hover:bg-raised"
          onClick={dismissOffline}
        >
          Back to the grid
        </button>
      </div>
    </div>
  );
}
