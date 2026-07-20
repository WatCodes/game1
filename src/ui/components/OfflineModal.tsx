import { useEffect, useRef } from 'react';
import { useGame } from '../../store/gameStore';
import { formatPower, formatShort, formatTime } from '../../engine/format';

export function OfflineModal() {
  const offline = useGame((s) => s.offline);
  const dismissOffline = useGame((s) => s.actions.dismissOffline);
  const claimOfflineDouble = useGame((s) => s.actions.claimOfflineDouble);
  const doubleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!offline) return;
    doubleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissOffline();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offline, dismissOffline]);

  if (!offline) return null;

  const earnedCredits = offline.creditsGained > 0;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-modal-title"
    >
      <div className="glass-deep w-full max-w-sm rounded-xl border border-line p-4">
        <h2 id="offline-modal-title" className="text-sm font-semibold uppercase tracking-widest text-ink-dim">
          While you were away
        </h2>
        <p className="mt-2 font-mono text-xs text-ink-dim">{formatTime(offline.seconds)} elapsed</p>

        {/* The headline reward is CR — what you sold the grid while away. */}
        <p className="mt-2 font-mono text-3xl text-volt">+{formatShort(Math.floor(offline.creditsGained))} CR</p>

        <div className="mt-1 space-y-0.5 font-mono text-xs text-ink-dim">
          <p>generated {formatPower(offline.powerGained)}</p>
          {offline.projectGained > 0 && (
            <p className="text-current">+{formatPower(offline.projectGained)} into construction</p>
          )}
          {offline.puzzlesSolved > 0 && <p>Auto-Solvers balanced {offline.puzzlesSolved} grids</p>}
        </div>

        {earnedCredits ? (
          <>
            <button
              ref={doubleRef}
              className="mt-4 w-full rounded border border-ok/60 bg-ok/10 px-3 py-2.5 text-sm font-semibold text-ok transition-colors hover:bg-ok/20"
              onClick={claimOfflineDouble}
            >
              ▶ Collect ×2 — +{formatShort(Math.floor(offline.creditsGained * 2))} CR
            </button>
            <button
              className="mt-2 w-full rounded border border-line px-3 py-1.5 text-xs text-ink-dim transition-colors hover:bg-raised hover:text-ink"
              onClick={dismissOffline}
            >
              Collect ×1
            </button>
          </>
        ) : (
          <button
            ref={doubleRef}
            className="mt-4 w-full rounded border border-current-dim px-3 py-2 text-sm text-current transition-colors hover:bg-raised"
            onClick={dismissOffline}
          >
            Back to the grid
          </button>
        )}
      </div>
    </div>
  );
}
