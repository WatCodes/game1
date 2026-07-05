import { useGame } from '../../store/gameStore';
import { formatPower } from '../../engine/format';

/** The spectacle: stages light up as committed power fills the build. */
export function MegaprojectPanel() {
  const mega = useGame((s) => s.display.mega);
  const power = useGame((s) => s.display.power);
  const setRoutePct = useGame((s) => s.actions.setRoutePct);
  const commitStoredPower = useGame((s) => s.actions.commitStoredPower);

  const pct = Math.floor(mega.progress * 100);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="rounded border border-line bg-panel p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">{mega.name}</h2>
          <span className="font-mono text-sm text-volt">{pct}%</span>
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-ink-dim">
          {formatPower(mega.committed)} / {formatPower(mega.total)} committed
        </p>

        {/* Stage segments — the Dyson rings lighting up */}
        <div className="mt-3 flex gap-1.5" role="img" aria-label={`${pct}% complete`}>
          {mega.stages.map((st, i) => (
            <div key={i} className="flex-1">
              <div
                className={`h-2.5 rounded-sm transition-all duration-500 ${
                  st.complete ? 'bg-current stage-lit' : 'bg-raised'
                }`}
              />
              <div className={`mt-1 text-center text-[9px] leading-tight ${st.complete ? 'text-current' : 'text-ink-dim'}`}>
                {st.label}
              </div>
            </div>
          ))}
        </div>

        {mega.complete ? (
          <p className="mt-3 rounded border border-ascend/40 bg-raised px-3 py-2 text-sm text-ascend">
            Construction complete. Ascension is available.
          </p>
        ) : (
          <>
            <label className="mt-4 block text-xs text-ink-dim" htmlFor="route-slider">
              Route <span className="font-mono text-current">{Math.round(mega.routePct * 100)}%</span> of grid output to
              construction
            </label>
            <input
              id="route-slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(mega.routePct * 100)}
              onChange={(e) => setRoutePct(Number(e.target.value) / 100)}
              className="mt-1 w-full accent-[var(--amber)]"
            />
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {([0.25, 0.5, 1] as const).map((f) => (
                <button
                  key={f}
                  className="rounded border border-volt-dim px-2 py-1.5 font-mono text-[11px] text-volt transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={power <= 0}
                  onClick={() => commitStoredPower(f)}
                >
                  Commit {f === 1 ? 'all' : `${f * 100}%`}
                  <br />
                  <span className="text-ink-dim">{formatPower(power * f)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-ink-dim">
        Each completed stage grants a permanent ×1.1 output bonus this run. Completing the project unlocks Ascension for
        this tier.
      </p>
    </div>
  );
}
