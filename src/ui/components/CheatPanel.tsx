import { useGame, type DevCheat } from '../../store/gameStore';

// Dev tools: visible in `npm run dev`, or on any build with ?dev in the URL.
export const DEV_MODE =
  import.meta.env.DEV || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev'));

const CHEATS: [DevCheat, string][] = [
  ['power', '+1h power'],
  ['rp', '+1000 RP'],
  ['credits', '+1000 CR'],
  ['kp', '+25 KP'],
  ['mega', 'Finish project'],
  ['dispatch', 'Fill dispatch'],
  ['peak', 'Trigger peak'],
  ['solve', 'Solve puzzle'],
  ['solver', '+1 solver'],
  ['warp', 'Warp +1h'],
  ['window', 'Open launch window (T3)'],
  ['flare', 'Trigger flare (T5)'],
  ['nextTier', 'Force-ascend to next tier'],
];

export function CheatPanel() {
  const devCheat = useGame((s) => s.actions.devCheat);
  if (!DEV_MODE) return null;

  return (
    <div className="rounded border border-danger/40 bg-panel/60 p-3">
      <h3 className="text-[11px] uppercase tracking-widest text-danger/80">Dev console</h3>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {CHEATS.map(([kind, label]) => (
          <button
            key={kind}
            className="rounded border border-line px-2 py-1.5 font-mono text-[11px] text-ink-dim transition-colors hover:bg-raised hover:text-ink"
            onClick={() => devCheat(kind)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-ink-dim">Hidden in production unless the URL has ?dev.</p>
    </div>
  );
}
