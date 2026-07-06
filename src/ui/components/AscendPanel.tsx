import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { formatShort } from '../../engine/format';

export function AscendPanel() {
  const ascendView = useGame((s) => s.display.ascend);
  const kp = useGame((s) => s.display.kp);
  const mega = useGame((s) => s.display.mega);
  const doAscend = useGame((s) => s.actions.doAscend);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="rounded border border-ascend/40 bg-panel p-3">
        <h2 className="text-base font-semibold text-ascend">Ascension</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          Reset your buildout and graduate to the <span className="text-ink">{ascendView.nextEra}</span> — powering{' '}
          <span className="text-ink">{ascendView.nextScale}</span>.
        </p>

        <div className="mt-3 rounded bg-raised px-3 py-2 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-ink-dim">Projected gain</span>
            <span className="text-ascend">+{formatShort(ascendView.projected)} KP</span>
          </div>
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-ink-dim">Current</span>
            <span>{formatShort(kp)} KP</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] leading-relaxed">
          <div className="rounded border border-line p-2">
            <div className="font-semibold uppercase tracking-wide text-danger">Resets</div>
            Power sources · stored power · run milestones · megaproject
          </div>
          <div className="rounded border border-line p-2">
            <div className="font-semibold uppercase tracking-wide text-ok">Keeps</div>
            Kardashev Points · all research · RP
          </div>
        </div>

        {!ascendView.can ? (
          <p className="mt-3 text-xs text-ink-dim">
            Blocked: complete the <span className="text-ink">{mega.name}</span> first (
            {Math.floor(mega.progress * 100)}% built).
          </p>
        ) : confirming ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="rounded border border-ascend bg-raised px-3 py-2 text-sm font-semibold text-ascend transition-colors hover:bg-ascend/10"
              onClick={() => {
                doAscend();
                setConfirming(false);
              }}
            >
              Confirm — Ascend
            </button>
            <button
              className="rounded border border-line px-3 py-2 text-sm text-ink-dim transition-colors hover:bg-raised"
              onClick={() => setConfirming(false)}
            >
              Not yet
            </button>
          </div>
        ) : (
          <button
            className="ascend-ready mt-3 w-full rounded border border-ascend px-3 py-2 text-sm font-semibold text-ascend transition-colors hover:bg-ascend/10"
            onClick={() => setConfirming(true)}
          >
            ⚡ Ascend — +{formatShort(ascendView.projected)} KP
          </button>
        )}
      </div>
    </div>
  );
}
