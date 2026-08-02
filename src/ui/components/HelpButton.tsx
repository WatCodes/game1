/**
 * Field Manual button. Mirrors SoundToggle on the left edge — the right edge
 * belongs to the rail, and a help affordance buried inside a panel is one the
 * player who needs it will never find.
 *
 * Sits just below the mute button so the two read as one utility column rather
 * than two loose circles.
 */
export function HelpButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      className="pointer-events-auto absolute left-3 top-[calc(46%+44px)] z-20 flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-95"
      style={{
        background: 'var(--bg-panel)',
        border: '1.5px solid var(--grid-line)',
        color: 'var(--text-dim)',
        boxShadow: '0 4px 10px rgba(0,0,0,.15)',
      }}
      onClick={onOpen}
      aria-label="Open the field manual"
    >
      <span className="font-mono text-[13px] leading-none">?</span>
    </button>
  );
}
