import { useEffect, useRef } from 'react';
import { useGame } from '../../store/gameStore';
import { formatShort } from '../../engine/format';

/**
 * The prestige payoff (design 4a): a full-screen takeover, no HUD. The one
 * screen that isn't parchment — violet over gold on near-black.
 *
 * Elements fade up on the design's stagger (.1 → 1.8s, 700ms ease-out each),
 * so the beat lands in sequence: what you're leaving, the medallion, what you
 * became, what you earned. There's no auto-dismiss — it ends when the player
 * chooses to begin the next age.
 */
const STARS = [
  { top: '11%', left: '13%', size: 2, delay: 0 },
  { top: '16%', right: '18%', size: 2, delay: 0.6 },
  { top: '25%', left: '23%', size: 1.5, delay: 1.2 },
  { bottom: '20%', right: '15%', size: 2, delay: 0.9 },
  { bottom: '28%', left: '17%', size: 1.5, delay: 1.6 },
];

export function AscensionOverlay() {
  const cinematic = useGame((s) => s.cinematic);
  const dismissCinematic = useGame((s) => s.actions.dismissCinematic);
  const ctaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!cinematic) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissCinematic();
    };
    window.addEventListener('keydown', onKey);
    // Focus the CTA once it has actually faded in (1.8s), so screen readers
    // and keyboard users land on it rather than on an invisible control.
    const t = window.setTimeout(() => ctaRef.current?.focus(), 1900);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [cinematic, dismissCinematic]);

  if (!cinematic) return null;

  return (
    <div
      className="cine-bg fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Ascended to ${cinematic.era}`}
    >
      {STARS.map((s, i) => (
        <span
          key={i}
          className="twinkle absolute rounded-full bg-white"
          style={{ ...s, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
          aria-hidden
        />
      ))}

      <div className="cine-item font-mono text-[11px] font-semibold" style={{ letterSpacing: '.4em', color: 'var(--violet)', animationDelay: '.1s' }}>
        ⚡ ENERGIZED
      </div>

      <div
        className="cine-item mt-7 font-display text-xs"
        style={{ letterSpacing: '.34em', color: '#9a8f76', animationDelay: '.3s' }}
      >
        YOU ASCEND FROM
      </div>
      <div
        className="cine-item font-display text-xl font-semibold line-through"
        style={{
          letterSpacing: '.12em',
          color: '#efe6cf',
          opacity: 0.55,
          textDecorationColor: 'rgba(239,230,207,.4)',
          animationDelay: '.4s',
        }}
      >
        {cinematic.fromEra.toUpperCase()}
      </div>

      {/* Medallion */}
      <div className="cine-item floaty mt-8" style={{ animationDelay: '.7s' }}>
        <div
          className="relative flex h-[132px] w-[132px] items-center justify-center rounded-full"
          style={{
            border: '2px solid #c8a24a',
            boxShadow: '0 0 40px rgba(200,162,74,.4), inset 0 0 30px rgba(167,139,250,.2)',
          }}
        >
          <div
            className="spin-slow absolute rounded-full"
            style={{ inset: -9, border: '1px dashed rgba(183,155,255,.5)' }}
            aria-hidden
          />
          <span
            className="bolt-shape block h-[60px] w-[38px]"
            style={{
              background: 'linear-gradient(#fff0c4, #c8a24a)',
              filter: 'drop-shadow(0 0 14px rgba(200,162,74,.9))',
            }}
          />
        </div>
      </div>

      {cinematic.kardashevLabel && (
        <div
          className="cine-item mt-7 font-mono text-[13px] font-semibold"
          style={{ letterSpacing: '.3em', color: '#c8a24a', animationDelay: '1s' }}
        >
          KARDASHEV {cinematic.kardashevLabel.replace(/^Type\s*/i, 'TYPE ')}
        </div>
      )}
      <div
        className="cine-item mt-1.5 font-display text-[34px] font-semibold"
        style={{
          letterSpacing: '.14em',
          color: '#efe6cf',
          textShadow: '0 0 22px rgba(167,139,250,.5)',
          animationDelay: '1.1s',
        }}
      >
        {cinematic.era.toUpperCase()}
      </div>
      <p
        className="cine-item mt-3 max-w-[250px] font-body text-[13px] italic leading-snug"
        style={{ color: '#9a8f76', animationDelay: '1.3s' }}
      >
        You now power {cinematic.scaleCopy}.
      </p>

      <div
        className="cine-item mt-6 flex items-center gap-2.5 rounded-[22px] px-5 py-2.5"
        style={{
          background: 'rgba(167,139,250,.14)',
          border: '1px solid rgba(167,139,250,.45)',
          animationDelay: '1.5s',
        }}
      >
        <span className="font-mono text-xl font-bold" style={{ color: 'var(--violet)' }}>
          +{formatShort(cinematic.kpGained)}
        </span>
        <span className="font-display text-[10px] font-semibold" style={{ letterSpacing: '.16em', color: 'var(--violet)' }}>
          KARDASHEV POINTS
        </span>
      </div>

      <button
        ref={ctaRef}
        className="cine-item absolute inset-x-6 bottom-11 rounded-[14px] py-3.5 font-display text-sm font-bold transition-opacity hover:opacity-90"
        style={{
          background: 'linear-gradient(#c3a2f0, #8a63d8)',
          color: '#160f28',
          letterSpacing: '.18em',
          animationDelay: '1.8s',
        }}
        onClick={dismissCinematic}
      >
        BEGIN THE {cinematic.era.toUpperCase()} ▸
      </button>
    </div>
  );
}
