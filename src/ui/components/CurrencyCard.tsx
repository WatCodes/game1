import { createPortal } from 'react-dom';
import { useGame } from '../../store/gameStore';
import { formatShort } from '../../engine/format';
import { CURRENCY_CARDS } from '../../content/tutorial';

export type CurrencyId = 'cr' | 'rp' | 'kp';

/** Where to draw: just below the chip bar, matching its width. */
export interface CardAnchor {
  top: number;
  left: number;
  width: number;
}

/**
 * The long version of a currency, opened by tapping its header chip.
 *
 * This is where the detail lives so the tutorial beats can stay at two
 * sentences (docs/TUTORIAL.md). The last line is always the player's own live
 * number — a general explanation lands better next to "and here is yours".
 *
 * Rendered through a portal onto <body>, not inside the header. The header is a
 * z-20 stacking context, and the sound, help and rail buttons are z-20 siblings
 * that come later in the DOM — so a card nested in the header was drawn *under*
 * them, with the ♪ button sitting on its text. Raising the whole header instead
 * would let its fade cover the top of the power-sources sheet.
 */
export function CurrencyCard({ id, anchor, onClose }: { id: CurrencyId; anchor: CardAnchor; onClose: () => void }) {
  const rpRate = useGame((s) => s.display.rpRate);
  const kp = useGame((s) => s.display.kp);
  const prestige = useGame((s) => s.display.prestige);
  const creditsPerSec = useGame((s) => s.display.board.creditsPerSec);
  const projected = useGame((s) => s.display.ascend.projected);
  const card = CURRENCY_CARDS[id];

  const yours =
    id === 'cr'
      ? `Right now you’re earning ${formatShort(creditsPerSec)} CR/s from selling power.`
      : id === 'rp'
        ? `Right now you’re earning ${rpRate.toFixed(2)} RP/s.`
        : `You have ${formatShort(kp)} KP — output ×${prestige.toFixed(2)}. Ascending now would earn ${formatShort(projected)} more.`;

  return createPortal(
    <>
      {/* Tap anywhere else to close. */}
      <button className="fixed inset-0 z-[60] cursor-default" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div
        className="fixed z-[61] rounded-xl border border-line px-3.5 py-3"
        style={{
          top: anchor.top + 4,
          left: anchor.left + 12,
          width: anchor.width - 24,
          background: 'var(--bg-panel)',
          boxShadow: '0 12px 32px rgba(0,0,0,.22)',
        }}
        role="dialog"
        aria-label={card.title}
      >
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[12px] font-semibold" style={{ letterSpacing: '.08em' }}>
            {card.title.toUpperCase()}
          </span>
          <button className="font-mono text-[13px] leading-none text-ink-dim hover:text-ink" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <dl className="mt-2 grid grid-cols-[3.4rem_1fr] gap-x-2 gap-y-1.5 font-body text-[11.5px] leading-snug">
          {card.lines.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-[9.5px] uppercase tracking-wider text-ink-dim">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2.5 border-t border-line pt-2 font-body text-[11px] italic text-ink-dim">{yours}</p>
      </div>
    </>,
    document.body,
  );
}
