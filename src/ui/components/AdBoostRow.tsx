import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { adsAvailable } from '../../platform/ads';
import { CONFIG } from '../../content/config';
import { formatTime } from '../../engine/format';

/**
 * Trade a rewarded video for the boost sitting directly above it in the shop.
 *
 * Deliberately offers exactly what the paid rows offer, at zero Credits. An ad
 * is a shortcut past a price, never a route to something otherwise unobtainable
 * — a player who never watches one is behind on convenience, not on content.
 *
 * On the web build there is no ad to show, so `showRewardedAd` resolves to
 * 'unavailable' and the boost is granted anyway (see `shouldGrantReward`). The
 * wording follows suit rather than promising a video that will not play.
 */
export function AdBoostRow() {
  const ads = useGame((s) => s.display.ads);
  const watchAdForBoost = useGame((s) => s.actions.watchAdForBoost);
  const [busy, setBusy] = useState(false);

  const minutes = Math.round(CONFIG.BOOST_SECONDS / 60);
  const verb = adsAvailable() ? 'Watch' : 'Claim';

  const take = async (kind: 'power' | 'rp') => {
    if (busy) return;
    setBusy(true);
    try {
      await watchAdForBoost(kind);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3.5 py-3"
      style={{ borderColor: 'rgba(184,137,47,.45)', background: 'rgba(184,137,47,.06)' }}
    >
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] font-mono text-[13px] font-bold"
        style={{ background: 'rgba(184,137,47,.12)', border: '1px solid rgba(184,137,47,.4)', color: 'var(--amber)' }}
      >
        ▶
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-body text-sm font-semibold">
          A Favour from the Gods
          <span className="ml-1.5 whitespace-nowrap font-mono text-[10px] font-normal text-ink-dim">{minutes} min</span>
        </div>
        <div className="font-body text-[10.5px] leading-snug text-ink-dim">
          {ads.canWatch
            ? `${verb} for a free ×${CONFIG.BOOST_MULT} boost — your pick.`
            : `Zeus is not feeling generous. Back in ${formatTime(ads.cooldownLeft)}.`}
        </div>
      </div>
      {ads.canWatch ? (
        <div className="flex shrink-0 gap-1.5">
          {(['power', 'rp'] as const).map((kind) => (
            <button
              key={kind}
              className="rounded-[9px] border px-2.5 py-2 font-mono text-[11px] font-semibold transition-colors disabled:opacity-45"
              style={{ borderColor: 'var(--amber)', background: 'rgba(184,137,47,.1)', color: 'var(--text)' }}
              disabled={busy}
              onClick={() => void take(kind)}
            >
              {kind === 'power' ? '×2 PWR' : '×2 RP'}
            </button>
          ))}
        </div>
      ) : (
        <span className="shrink-0 font-mono text-[10px] uppercase text-ink-dim">{formatTime(ads.cooldownLeft)}</span>
      )}
    </div>
  );
}
