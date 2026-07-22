import { useGame } from '../../store/gameStore';
import { formatPower, formatShort } from '../../engine/format';

/**
 * The Wonder pop-up (design 3a) — your signature megaproject, "watch it build"
 * energy in marble & gold. It rises tier by tier at the top of the panel while
 * the stage rail and readouts track progress, and you steer how much of the
 * grid feeds it right here rather than being sent to the Dispatch Board.
 *
 * The mockup's single "route to construction" slider is adapted to the shipped
 * three-rail board: this drives the **Project rail** (`setRoutePct`), and every
 * point it climbs is a point taken off Sell — that trade is stated, not hidden.
 */

/** ~time to fill up to the current authorized ceiling at the present inflow. */
function fillLabel(remaining: number, inflowPerSec: number): string {
  if (inflowPerSec <= 0) return 'Nothing is building.';
  const secs = remaining / inflowPerSec;
  if (secs < 1) return 'Fills any moment.';
  if (secs < 90) return `Fills in ~${Math.ceil(secs)}s.`;
  if (secs < 5400) return `Fills in ~${Math.ceil(secs / 60)} min.`;
  return `Fills in ~${(secs / 3600).toFixed(1)} h.`;
}

export function MegaprojectPanel() {
  const mega = useGame((s) => s.display.mega);
  const board = useGame((s) => s.display.board);
  const pps = useGame((s) => s.display.pps);
  const rp = useGame((s) => s.display.rp);
  const authorizeNextStage = useGame((s) => s.actions.authorizeNextStage);
  const setRoutePct = useGame((s) => s.actions.setRoutePct);

  const pct = Math.floor(mega.progress * 100);
  const total = mega.stages.length;
  const done = mega.stages.filter((st) => st.complete).length;
  const currentStage = Math.min(done + 1, total);
  const atBoundary = !mega.complete && mega.committed >= mega.boundary - 1e-6;
  const allAuthorized = mega.stagesAuthorized >= total;

  const proj = Math.round(board.projPct * 100);
  const remaining = Math.max(0, mega.boundary - mega.committed);
  const inflow = pps * board.projPct; // intended Project-rail inflow, W/s

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* --- the Wonder, rising --- */}
      <div
        className="relative flex h-[132px] items-end justify-center overflow-hidden rounded-2xl border border-line"
        style={{ background: 'linear-gradient(var(--sky), var(--marble))' }}
        role="img"
        aria-label={`${mega.name}, ${pct}% built`}
      >
        {/* a lit bolt crowns it once construction is actually flowing */}
        {!mega.complete && inflow > 0 && (
          <span
            className="bolt-shape flick absolute top-2 h-8 w-5"
            style={{ background: 'linear-gradient(#ffe08a, var(--amber))', filter: 'drop-shadow(0 0 8px rgba(184,137,47,.85))' }}
          />
        )}
        {mega.complete && (
          <span className="absolute top-3 font-mono text-[9px] font-semibold tracking-[.24em] text-volt">◆ COMPLETE</span>
        )}

        {/* five tiers stacked bottom-wide → top-narrow; lit / filling / ghosted.
            Drawn top stage first, so the index counts down as we go down. */}
        <div className="mb-3 flex flex-col items-center gap-[3px]">
          {mega.stages.map((_, i) => {
            const idx = total - 1 - i;
            const stage = mega.stages[idx];
            const built = stage.complete;
            const authorized = idx < mega.stagesAuthorized;
            // Wide at the base, narrowing upward — a monument rising, not a
            // funnel. The first stage (idx 0) is the widest, lowest course.
            const width = 44 + (total - 1 - idx) * 20;
            const fill = Math.max(0, Math.min(1, mega.progress * total - idx));
            const filling = !built && fill > 0;
            return (
              <div
                key={idx}
                className="relative h-4 overflow-hidden rounded-[3px]"
                style={{
                  width,
                  background: built
                    ? 'linear-gradient(var(--gold-lit), var(--gold-deep))'
                    : authorized
                      ? 'var(--marble-deep)'
                      : 'transparent',
                  border: authorized ? 'none' : '1px dashed var(--marble-deep)',
                  boxShadow: built ? '0 0 10px rgba(184,137,47,.5)' : 'none',
                }}
              >
                {filling && (
                  <span
                    className="absolute inset-y-0 left-0"
                    style={{ width: `${fill * 100}%`, background: 'linear-gradient(90deg, var(--amber-dim), var(--amber))' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- name + intent --- */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-body text-lg font-semibold leading-tight">{mega.name}</h2>
          <span className="shrink-0 font-mono text-sm font-bold text-volt">{pct}%</span>
        </div>
        <p className="mt-0.5 font-body text-[12px] italic leading-snug text-ink-dim">
          Your signature Wonder. Complete it to ascend the Kardashev scale.
        </p>
      </div>

      {/* --- stage rail --- */}
      <div>
        <div className="flex gap-1.5">
          {mega.stages.map((st, i) => {
            const authorized = i < mega.stagesAuthorized;
            const fill = Math.max(0, Math.min(1, mega.progress * total - i));
            const filling = fill > 0 && fill < 1;
            return (
              <div key={i} className="flex-1">
                <div className={`stage-cell ${st.complete ? 'done' : ''} ${filling ? 'filling' : ''} ${!authorized ? 'striped opacity-50' : ''}`}>
                  <span style={{ width: `${fill * 100}%` }} />
                </div>
                <div
                  className={`mt-1 text-center text-[9px] leading-tight ${
                    st.complete ? 'text-volt' : authorized ? 'text-ink-dim' : 'text-ink-dim opacity-60'
                  }`}
                >
                  {authorized ? st.label : `🔒 ${st.label}`}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] font-semibold text-ink-dim">
          <span>STAGE {currentStage} OF {total}</span>
          <span className="text-volt">
            {formatPower(mega.committed)} / {formatPower(mega.total)}
          </span>
        </div>
      </div>

      {mega.complete ? (
        <p className="rounded-xl border border-ascend/40 bg-raised px-3 py-2.5 text-sm text-ascend">
          Construction complete. Ascension is available on the rail.
        </p>
      ) : (
        <>
          {/* --- route to construction (the Project rail, adapted) --- */}
          <div className="rounded-xl border border-line bg-raised px-3.5 py-3">
            <div className="flex items-baseline justify-between font-mono text-[11px] font-semibold">
              <label htmlFor="wonder-route" className="text-ink">ROUTE TO CONSTRUCTION</label>
              <span className="text-volt">{proj}%</span>
            </div>
            <input
              id="wonder-route"
              type="range"
              min={0}
              max={100}
              step={5}
              value={proj}
              onChange={(e) => setRoutePct(Number(e.target.value) / 100)}
              className="mt-2.5 w-full accent-[var(--amber)]"
            />
            <p className="mt-1.5 font-body text-[11px] italic leading-snug text-ink-dim">
              Diverting {proj}% of generation. {fillLabel(remaining, inflow)}
              {proj > 0 && proj < 100 && <span> The rest still sells for Credits.</span>}
            </p>
          </div>

          {/* --- authorization: the RP gate --- */}
          {!allAuthorized &&
            (mega.authBlockedBy ? (
              <div className="rounded-xl border border-current/40 bg-current/[.06] px-3.5 py-2.5">
                <p className="font-body text-[12px] leading-snug text-current">
                  <b>Next stage locked.</b> Research <span className="font-semibold">{mega.authBlockedBy}</span> in the Lab
                  to authorize it.
                </p>
              </div>
            ) : (
              <div className={`rounded-xl border px-3.5 py-3 ${atBoundary ? 'border-volt' : 'border-line'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-body text-[12px] leading-snug text-ink-dim">
                    {atBoundary ? 'Construction paused — authorize the next stage to continue.' : 'Authorize the next stage.'}
                  </p>
                  <button
                    className={`shrink-0 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors ${
                      mega.canAuthorize
                        ? 'border-volt bg-volt/10 text-volt hover:bg-volt/20'
                        : 'cursor-not-allowed border-line text-ink-dim'
                    }`}
                    disabled={!mega.canAuthorize}
                    onClick={authorizeNextStage}
                  >
                    {formatShort(mega.nextStageRp)} RP
                    {rp < mega.nextStageRp && <span className="ml-1 opacity-70">(have {formatShort(Math.floor(rp))})</span>}
                  </button>
                </div>
              </div>
            ))}

          {/* --- the cost of the next stage: it dismantles your weakest plants --- */}
          {mega.decommissionPct > 0 && (
            <p className="rounded-xl border border-danger/40 bg-danger/[.06] px-3.5 py-2.5 font-body text-[12px] leading-snug text-danger">
              ⚠ Completing the next stage dismantles {Math.round(mega.decommissionPct * 100)}% of your fleet — your
              lowest-output plants go first.
            </p>
          )}

          <p className="px-0.5 text-[11px] leading-relaxed text-ink-dim">
            Each completed stage grants a permanent ×1.1 output bonus this run. Stages 3–5 need this tier's key research.
            Completing the Wonder unlocks Ascension.
          </p>
        </>
      )}
    </div>
  );
}
