import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { adsAvailable } from '../../platform/ads';
import { CONFIG } from '../../content/config';

/**
 * The occasional "fancy a boost?" prompt.
 *
 * Everything about this component is shaped by one promise on the App Store
 * listing: "No forced ads, ever. No timers blocking your progress."
 *
 *   - It is **not** a modal. No backdrop, no focus trap, no pointer-events over
 *     the rest of the screen. The game keeps running and stays playable behind
 *     and around it.
 *   - It has a visible dismiss control, and dismissing costs nothing.
 *   - It withdraws itself if ignored (`AD_OFFER_LIFETIME_SECONDS`), so it cannot
 *     become permanent furniture the player learns to see through.
 *   - It never appears while the boost is on cooldown, so it is always
 *     actionable when shown.
 *
 * If any of those stop being true, the store description has to change in the
 * same release.
 */
export function AdOfferCard() {
  const offer = useGame((s) => s.display.ads.offer);
  const acceptAdOffer = useGame((s) => s.actions.acceptAdOffer);
  const dismissAdOffer = useGame((s) => s.actions.dismissAdOffer);
  const [busy, setBusy] = useState(false);

  if (!offer) return null;

  const minutes = Math.round(CONFIG.BOOST_SECONDS / 60);
  const label = offer === 'power' ? `×${CONFIG.BOOST_MULT} power` : `×${CONFIG.BOOST_MULT} research`;
  const verb = adsAvailable() ? 'Watch' : 'Claim';

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await acceptAdOffer();
    } finally {
      setBusy(false);
    }
  };

  return (
    // pointer-events-none on the positioner, auto on the card: taps anywhere
    // else still reach the game underneath.
    <div className="pointer-events-none fixed inset-x-0 bottom-[86px] z-30 flex justify-center px-4">
      <div
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-lg"
        style={{
          borderColor: 'rgba(184,137,47,.5)',
          background: 'var(--bg-raised)',
          boxShadow: '0 8px 24px rgba(44,35,24,.22)',
        }}
        role="status"
      >
        <span className="shrink-0 font-mono text-base" aria-hidden>
          ⚡
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-body text-[12.5px] font-semibold leading-snug">
            A cat found a spare reel of lightning.
          </div>
          <div className="font-body text-[10.5px] leading-snug text-ink-dim">
            {verb} for {label}, {minutes} min. Entirely optional.
          </div>
        </div>
        <button
          className="shrink-0 rounded-[9px] border px-2.5 py-1.5 font-mono text-[11px] font-semibold disabled:opacity-45"
          style={{ borderColor: 'var(--amber)', background: 'rgba(184,137,47,.12)', color: 'var(--text)' }}
          disabled={busy}
          onClick={() => void accept()}
        >
          ▶
        </button>
        <button
          className="shrink-0 rounded-[9px] px-2 py-1.5 font-mono text-[13px] leading-none text-ink-dim transition-colors hover:text-ink"
          onClick={dismissAdOffer}
          aria-label="No thanks"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
