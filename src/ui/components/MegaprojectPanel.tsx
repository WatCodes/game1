import { useGame } from '../../store/gameStore';
import { formatPower, formatShort } from '../../engine/format';

/**
 * The spectacle: stages light up as committed power fills the build — but each
 * stage past the first must be authorized with RP, and the later ones need the
 * tier's key research. Power alone can't finish it.
 */
export function MegaprojectPanel() {
  const mega = useGame((s) => s.display.mega);
  const rp = useGame((s) => s.display.rp);
  const power = useGame((s) => s.display.power);
  const setRoutePct = useGame((s) => s.actions.setRoutePct);
  const commitStoredPower = useGame((s) => s.actions.commitStoredPower);
  const authorizeNextStage = useGame((s) => s.actions.authorizeNextStage);

  const pct = Math.floor(mega.progress * 100);
  const atBoundary = !mega.complete && mega.committed >= mega.boundary - 1e-6;
  const allAuthorized = mega.stagesAuthorized >= mega.stages.length;

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
          {mega.stages.map((st, i) => {
            const authorized = i < mega.stagesAuthorized;
            return (
              <div key={i} className="flex-1">
                <div
                  className={`h-2.5 rounded-sm transition-all duration-500 ${
                    st.complete ? 'bg-current stage-lit' : authorized ? 'bg-raised' : 'bg-raised opacity-40'
                  }`}
                />
                <div
                  className={`mt-1 text-center text-[9px] leading-tight ${
                    st.complete ? 'text-current' : authorized ? 'text-ink-dim' : 'text-ink-dim opacity-60'
                  }`}
                >
                  {authorized ? st.label : `🔒 ${st.label}`}
                </div>
              </div>
            );
          })}
        </div>

        {mega.complete ? (
          <p className="mt-3 rounded border border-ascend/40 bg-raised px-3 py-2 text-sm text-ascend">
            Construction complete. Ascension is available.
          </p>
        ) : (
          <>
            {/* Stage authorization — the RP gate */}
            {!allAuthorized && (
              <div className={`mt-3 rounded border px-3 py-2 ${atBoundary ? 'border-volt-dim' : 'border-line'}`}>
                {mega.authBlockedBy ? (
                  <p className="text-xs text-ink-dim">
                    Next stage needs research: <span className="text-ink">{mega.authBlockedBy}</span>
                  </p>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-ink-dim">
                      {atBoundary ? 'Construction paused — authorize the next stage' : 'Next stage authorization'}
                    </p>
                    <button
                      className={`shrink-0 rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                        mega.canAuthorize
                          ? 'border-current-dim text-current hover:bg-raised'
                          : 'border-line text-ink-dim cursor-not-allowed'
                      }`}
                      disabled={!mega.canAuthorize}
                      onClick={authorizeNextStage}
                    >
                      Authorize — {formatShort(mega.nextStageRp)} RP
                      {rp < mega.nextStageRp && <span className="text-ink-dim"> (have {formatShort(Math.floor(rp))})</span>}
                    </button>
                  </div>
                )}
              </div>
            )}

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
              {([0.25, 0.5, 1] as const).map((f) => {
                const amount = Math.min(power * f, mega.maxCommit);
                return (
                  <button
                    key={f}
                    className="rounded border border-volt-dim px-2 py-1.5 font-mono text-[11px] text-volt transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={amount <= 0}
                    onClick={() => commitStoredPower(f)}
                  >
                    Commit {f === 1 ? 'all' : `${f * 100}%`}
                    <br />
                    <span className="text-ink-dim">{amount > 0 ? formatPower(amount) : '—'}</span>
                  </button>
                );
              })}
            </div>
            {mega.maxCommit < power && mega.maxCommit >= 0 && !atBoundary && (
              <p className="mt-1.5 font-mono text-[10px] text-ink-dim">
                Commits are capped so you always keep enough to buy your next source.
              </p>
            )}
          </>
        )}
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-ink-dim">
        Each completed stage grants a permanent ×1.1 output bonus this run. Stages 3–5 need this tier's key research
        before they can be authorized. Completing the project unlocks Ascension.
      </p>
    </div>
  );
}
