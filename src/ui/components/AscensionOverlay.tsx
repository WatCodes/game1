import { useEffect, useRef } from 'react';
import { useGame } from '../../store/gameStore';
import { formatShort } from '../../engine/format';

/** The prestige payoff: a short title-card beat when a new era begins. */
export function AscensionOverlay() {
  const cinematic = useGame((s) => s.cinematic);
  const dismissCinematic = useGame((s) => s.actions.dismissCinematic);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!cinematic) return;
    closeRef.current?.focus();
    const t = setTimeout(dismissCinematic, 4500);
    // Enter/Space already activate the focused button natively; only Escape
    // needs an explicit handler here.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissCinematic();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [cinematic, dismissCinematic]);

  if (!cinematic) return null;

  return (
    <button
      ref={closeRef}
      className="cine-bg fixed inset-0 z-50 flex w-full flex-col items-center justify-center gap-3 px-6 text-center"
      onClick={dismissCinematic}
      aria-label="Ascension complete, tap to continue"
    >
      <span className="cine-item font-mono text-[11px] uppercase tracking-[0.4em] text-ascend">Ascension</span>
      <span className="cine-item cine-title text-3xl font-semibold text-ink" style={{ animationDelay: '250ms' }}>
        {cinematic.era}
      </span>
      {cinematic.kardashevLabel && (
        <span
          className="cine-item rounded border border-ascend/50 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ascend"
          style={{ animationDelay: '450ms' }}
        >
          {cinematic.kardashevLabel} civilization
        </span>
      )}
      <span className="cine-item font-mono text-sm text-ink-dim" style={{ animationDelay: '650ms' }}>
        Powering: {cinematic.scaleCopy}
      </span>
      <span className="cine-item readout text-xl" style={{ animationDelay: '850ms', color: 'var(--violet)' }}>
        +{formatShort(cinematic.kpGained)} Kardashev Points
      </span>
      <span className="cine-item mt-4 font-mono text-[10px] uppercase tracking-widest text-ink-dim" style={{ animationDelay: '1400ms' }}>
        tap to continue
      </span>
    </button>
  );
}
