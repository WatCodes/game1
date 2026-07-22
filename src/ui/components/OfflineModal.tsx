import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { formatPower, formatShort, formatTime } from '../../engine/format';
import { adsAvailable } from '../../platform/ads';
import { Cat } from './Courtyard';
import { DEFAULT_CATS, type CatSkin } from './AgeFrame';

/**
 * "While you were away" (design 6b) — the return moment. The cats kept the grid
 * humming; the earnings are tallied on a marble slab with a warm one-tap
 * collect. One cat stands watch, the other slept on the ledger.
 *
 * The ×2 path is the product's away-earning ad hook (Wyatt's brief) and stays
 * front-and-centre: watching doubles the take, and a plain Collect ×1 is always
 * there so an ad failure can never gate progress.
 */

/** A curled-up sleeping cat — the mockup's dozing tabby with its `z z`. */
function SleepingCat({ skin }: { skin: CatSkin }) {
  return (
    <div className="absolute bottom-[18px] left-[54%] scale-95">
      {/* low, curled body */}
      <div
        className="h-[18px] w-[42px]"
        style={{ background: `linear-gradient(160deg, ${skin.body}, ${skin.bodyDeep})`, borderRadius: '50% 50% 40% 40%' }}
      />
      {/* head resting */}
      <div className="absolute -top-2 left-0.5 h-3.5 w-4 rounded-full" style={{ background: skin.body }} />
      <div
        className="absolute -top-[13px] left-0.5 h-0 w-0"
        style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `7px solid ${skin.ear}` }}
      />
      <div
        className="absolute -top-[13px] left-[9px] h-0 w-0"
        style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `7px solid ${skin.ear}` }}
      />
      {/* closed eye — a soft line, not a dot */}
      <div className="absolute -top-[3px] left-[5px] h-0.5 w-2 rounded-full" style={{ background: 'var(--text)', opacity: 0.5 }} />
      <div className="twinkle absolute -top-4 -right-2 font-mono text-[9px] text-ink-dim">z z</div>
    </div>
  );
}

export function OfflineModal() {
  const offline = useGame((s) => s.offline);
  const dismissOffline = useGame((s) => s.actions.dismissOffline);
  const claimOfflineDouble = useGame((s) => s.actions.claimOfflineDouble);
  const doubleRef = useRef<HTMLButtonElement>(null);
  // The ad is async; block re-entry so a double-tap can't fire two of them.
  const [claiming, setClaiming] = useState(false);

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
  const [watch, doze] = DEFAULT_CATS;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(44,35,24,.62), rgba(24,18,10,.82))' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-modal-title"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-[22px] border border-line"
        style={{ background: 'var(--bg-panel)', boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}
      >
        {/* --- masthead --- */}
        <div className="px-5 pb-1 pt-6 text-center">
          <div className="font-mono text-[10px] font-semibold tracking-[.3em] text-current">
            AWAY {formatTime(offline.seconds).toUpperCase()}
          </div>
          <h2 id="offline-modal-title" className="mt-2 font-display text-2xl font-semibold" style={{ letterSpacing: '.08em' }}>
            The Cats Kept Watch
          </h2>
          <p className="mt-1.5 font-body text-[12px] italic leading-snug text-ink-dim">
            The grid never slept. Neither did they — mostly.
          </p>
        </div>

        {/* --- one on watch, one asleep on the ledger --- */}
        <div className="relative mt-2 h-[76px]">
          {/* The Cat anchors at its body, with head/ears above and tail below,
              so it needs headroom above and a clear gap to the tally card. */}
          <div className="absolute bottom-5 left-[34%]">
            <Cat className="floaty" {...watch} />
          </div>
          <SleepingCat skin={doze} />
        </div>

        {/* --- the tally --- */}
        <div className="mx-[18px] mt-1 overflow-hidden rounded-xl border border-line" style={{ background: 'var(--bg-raised)' }}>
          <TallyRow label="Power generated" value={formatPower(offline.powerGained)} />
          <TallyRow label="Credits earned" value={`+${formatShort(Math.floor(offline.creditsGained))} CR`} tone="gold" />
          {offline.projectGained > 0 && (
            <TallyRow label="Into construction" value={`+${formatPower(offline.projectGained)}`} tone="blue" />
          )}
          {offline.puzzlesSolved > 0 && (
            <TallyRow label="Grids balanced" value={`${offline.puzzlesSolved}`} tone="blue" last />
          )}
        </div>

        {/* --- collect --- */}
        <div className="px-[18px] pb-5 pt-4">
          {earnedCredits ? (
            <>
              <button
                ref={doubleRef}
                className="flex w-full items-center justify-center gap-2 rounded-[13px] px-4 py-3.5 font-display text-[13px] font-bold tracking-[.14em] text-[#2c2318] transition-transform active:scale-[.98] disabled:opacity-60"
                style={{ background: 'linear-gradient(180deg, var(--gold-lit), var(--gold-deep))', boxShadow: '0 6px 16px -6px rgba(169,120,31,.8)' }}
                disabled={claiming}
                onClick={async () => {
                  if (claiming) return;
                  setClaiming(true);
                  try {
                    await claimOfflineDouble();
                  } finally {
                    setClaiming(false);
                  }
                }}
              >
                {claiming ? (
                  'LOADING…'
                ) : (
                  <>
                    ▶ {adsAvailable() ? 'WATCH & COLLECT' : 'COLLECT'} ×2
                    <span className="font-mono font-semibold opacity-80">
                      +{formatShort(Math.floor(offline.creditsGained * 2))} CR
                    </span>
                  </>
                )}
              </button>
              <button
                className="mt-2 w-full rounded-[11px] py-2 font-mono text-[11px] text-ink-dim transition-colors hover:text-ink disabled:opacity-60"
                disabled={claiming}
                onClick={dismissOffline}
              >
                Collect ×1 and return
              </button>
            </>
          ) : (
            <button
              ref={doubleRef}
              className="w-full rounded-[13px] px-4 py-3.5 font-display text-[13px] font-bold tracking-[.14em] text-[#2c2318] transition-transform active:scale-[.98]"
              style={{ background: 'linear-gradient(180deg, var(--gold-lit), var(--gold-deep))', boxShadow: '0 6px 16px -6px rgba(169,120,31,.8)' }}
              onClick={dismissOffline}
            >
              COLLECT &amp; RETURN
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TallyRow({
  label,
  value,
  tone = 'ink',
  last = false,
}: {
  label: string;
  value: string;
  tone?: 'ink' | 'gold' | 'blue';
  last?: boolean;
}) {
  const color = tone === 'gold' ? 'text-volt' : tone === 'blue' ? 'text-current' : 'text-ink';
  return (
    <div className={`flex items-center justify-between px-3.5 py-2.5 ${last ? '' : 'border-b border-line'}`}>
      <span className="font-body text-[12px] text-ink-dim">{label}</span>
      <span className={`font-mono text-[12px] font-bold ${color}`}>{value}</span>
    </div>
  );
}
