import { useEffect, useRef, useState } from 'react';
import { Cat } from './Courtyard';

const SEEN_KEY = 'kardashev:ui:intro';

/**
 * First-run intro (design 6c). The premise is delivered *in the courtyard*
 * rather than on abstract text cards: a spotlight vignette isolates whatever
 * Pyrrha is talking about, and she talks you through the first minute.
 *
 * The spotlight is a radial hole punched in a scrim, moved per beat, so the
 * world stays visible and the tutorial points at real things.
 */
interface Beat {
  /** Spotlight centre + radius, in viewport units. */
  x: string;
  y: string;
  r: number;
  /** Where Pyrrha stands — she should stay at the light's edge, not narrate
   *  from the dark once the spotlight moves on. */
  cat: string;
  bubbleTop: string;
  copy: React.ReactNode;
}

/**
 * Premise, the rail, the send-off — and no instructions.
 *
 * The intro used to teach the kneader and the altar too. The altar beat could not
 * be followed (dispatch needs generation, and a new player has none), and neither
 * instruction could be *done* while this overlay covered the screen. Both are now
 * tutorial moments (docs/TUTORIAL.md) that appear beside the real control, at the
 * point it will work, and wait for the player to do it. This keeps only what is
 * worth reading before playing.
 */
const BEATS: Beat[] = [
  {
    x: '50%',
    y: '52%',
    r: 120,
    cat: 'left-[calc(50%-92px)] top-[calc(52%+8px)]',
    bubbleTop: '150px',
    copy: (
      <>
        Zeus hoards the lightning. We&rsquo;re going to <i>borrow</i> it.
      </>
    ),
  },
  {
    x: '88%',
    y: '58%',
    r: 130,
    cat: 'left-[calc(88%-104px)] top-[calc(58%+10px)]',
    bubbleTop: '150px',
    copy: <>The Lab, the Wonder, the Works, the Agora. Everything else lives on that rail.</>,
  },
  {
    x: '50%',
    y: '55%',
    r: 420,
    cat: 'left-[calc(50%-92px)] top-[calc(52%+8px)]',
    bubbleTop: '150px',
    copy: <>The city is yours now, keeper. Light it up.</>,
  },
];

/** Whether the intro has already run on this device. */
export function introSeen(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(SEEN_KEY) === 'seen';
  } catch {
    return false;
  }
}

/** `onFinish` lets the tutorial layer start only once the intro is out of the way. */
export function IntroOverlay({ onFinish }: { onFinish?: () => void }) {
  const [open, setOpen] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(SEEN_KEY) !== 'seen';
  });
  const [step, setStep] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) btnRef.current?.focus();
  }, [open, step]);

  if (!open) return null;

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, 'seen');
    } catch {
      /* private mode — it'll show again next launch */
    }
    setOpen(false);
    onFinish?.();
  };

  const beat = BEATS[step];
  const last = step === BEATS.length - 1;
  const advance = () => (last ? finish() : setStep((s) => s + 1));

  return (
    <div
      className="absolute inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label="Introduction"
      onClick={advance}
    >
      {/* Spotlight: a soft hole in the scrim, over the living courtyard. */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: `radial-gradient(circle ${beat.r}px at ${beat.x} ${beat.y}, rgba(44,35,24,0) 0%, rgba(44,35,24,0) 62%, rgba(44,35,24,.62) 100%)`,
        }}
      />


      {/* Pyrrha, at the light's edge — the courtyard's own tabby. */}
      <Cat
        key={step}
        className={`floaty ${beat.cat} scale-110`}
        body="#8a7458"
        bodyDeep="#5c4a36"
        ear="#6f5a42"
        tail="#5a4a3a"
        eye="#7fd0c0"
        flip
      />

      {/* Speech bubble with the arrow notch */}
      <div
        className="absolute inset-x-6 rounded-2xl border border-line"
        style={{ top: beat.bubbleTop, background: 'var(--bg-panel)', boxShadow: '0 12px 32px rgba(0,0,0,.3)', padding: '14px 18px' }}
      >
        <div className="font-mono text-[10px] font-semibold" style={{ letterSpacing: '.24em', color: 'var(--danger)' }}>
          PYRRHA · KEEPER OF THE FLAME
        </div>
        <div className="mt-1.5 font-body text-sm font-medium leading-[1.45]">{beat.copy}</div>
        <div
          className="absolute -bottom-2 left-16 h-3.5 w-3.5 rotate-45 border-b border-r border-line"
          style={{ background: 'var(--bg-panel)' }}
          aria-hidden
        />
      </div>

      {/* Step dots */}
      <div className="absolute inset-x-0 bottom-9 flex justify-center gap-[7px]">
        {BEATS.map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === step ? 20 : 6,
              background: i === step ? 'var(--amber)' : 'rgba(251,246,234,.55)',
            }}
          />
        ))}
      </div>

      <button
        ref={btnRef}
        className="absolute bottom-[30px] right-5 font-mono text-[10px] font-semibold"
        style={{ color: 'rgba(251,246,234,.85)' }}
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
      >
        SKIP ▸
      </button>
    </div>
  );
}
