import { useCallback, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { formatShort } from '../../engine/format';

/**
 * The living courtyard (design 2a) — the home screen IS the game world.
 * Shapes, colours and motion are ported from the Greek Courtyard mockup.
 *
 * The altar is the primary tap target. Rather than invent a new manual-
 * generation mechanic, it fires **dispatch**, which already means "channel a
 * burst of power and sell it" — so the courtyard drives a real system instead
 * of being scenery with a button glued on.
 */

interface Pop {
  id: number;
  amount: number;
  x: number;
}

let popSeq = 0;

function Cat({
  className = '',
  body,
  bodyDeep,
  ear,
  tail,
  eye,
  flip = false,
  delay = 0,
}: {
  className?: string;
  body: string;
  bodyDeep: string;
  ear: string;
  tail: string;
  eye: string;
  flip?: boolean;
  delay?: number;
}) {
  return (
    <div className={`absolute ${className}`}>
      {/* soft contact shadow */}
      <div
        className="absolute -bottom-1 left-0 h-2 w-[34px] rounded-[50%] blur-[2px]"
        style={{ background: 'rgba(0,0,0,.16)' }}
      />
      <div
        className="tail absolute bottom-2 h-[22px] w-[7px] rounded-[7px]"
        style={{ background: tail, animationDelay: `${delay}s`, [flip ? 'left' : 'right']: '-7px' }}
      />
      {/* body */}
      <div
        className="h-[30px] w-[28px]"
        style={{ background: `linear-gradient(160deg, ${body}, ${bodyDeep})`, borderRadius: '48% 48% 42% 42%' }}
      />
      {/* head */}
      <div
        className="absolute left-1 top-[-13px] h-5 w-[22px] rounded-full"
        style={{ background: `linear-gradient(160deg, ${body}, ${ear})` }}
      />
      {/* ears */}
      <div
        className="absolute left-1 top-[-19px] h-0 w-0"
        style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `10px solid ${ear}` }}
      />
      <div
        className="absolute left-[15px] top-[-19px] h-0 w-0"
        style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `10px solid ${ear}` }}
      />
      {/* eyes — one dot plus a box-shadow twin, as in the mockup */}
      <div
        className="absolute left-[9px] top-[-5px] h-[3px] w-[3px] rounded-full"
        style={{ background: eye, boxShadow: `6px 0 0 ${eye}` }}
      />
    </div>
  );
}

export function Courtyard() {
  const sources = useGame((s) => s.display.sources);
  const dispatch = useGame((s) => s.display.dispatch);
  const doDispatch = useGame((s) => s.actions.doDispatch);
  const credits = useGame((s) => s.display.credits);

  const [pops, setPops] = useState<Pop[]>([]);
  const before = useRef(credits);

  // Installations follow the real buildout — the courtyard should be a readout
  // of the grid, not decoration.
  const built = sources.filter((s) => s.unlocked && s.owned > 0).slice(0, 2);

  const channel = useCallback(() => {
    const prev = before.current;
    doDispatch();
    // The store updates synchronously; read the new balance for the popup.
    const gained = useGame.getState().display.credits - prev;
    before.current = useGame.getState().display.credits;
    if (gained > 0) {
      const id = ++popSeq;
      setPops((p) => [...p.slice(-4), { id, amount: gained, x: 42 + Math.random() * 16 }]);
      window.setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 2600);
    }
  }, [doDispatch]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* sky */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(var(--sky) 0%, var(--marble) 42%, #e0cb9c 100%)' }}
      />
      {/* sun */}
      <div
        className="absolute right-10 top-[52px] h-11 w-11 rounded-full"
        style={{
          background: 'radial-gradient(circle at 60% 40%, #fff0c4, var(--sun))',
          boxShadow: '0 0 40px rgba(244,185,66,.55)',
        }}
      />
      <div className="cloud-a absolute left-0 top-[104px] h-[15px] w-[60px] rounded-[10px] bg-white/70" />
      <div className="cloud-b absolute left-0 top-[146px] h-3 w-11 rounded-[10px] bg-white/55" />

      {/* receding stone floor + flagstone grid */}
      <div
        className="absolute inset-x-0 bottom-0 h-[62%]"
        style={{
          background: 'linear-gradient(var(--stone), var(--stone-deep))',
          clipPath: 'polygon(24% 0, 76% 0, 100% 100%, 0 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[62%] opacity-50"
        style={{
          clipPath: 'polygon(24% 0, 76% 0, 100% 100%, 0 100%)',
          backgroundImage:
            'repeating-linear-gradient(#00000010 0 1px, transparent 1px 34px), repeating-linear-gradient(90deg, #00000010 0 1px, transparent 1px 40px)',
        }}
      />

      {/* Back colonnade — anchored to the floor's back edge (bottom-[62%]), not
          to the viewport top, or the temple floats in the sky. */}
      <div className="absolute bottom-[62%] left-1/2 flex -translate-x-1/2 items-end gap-3">
        {[46, 52, 56, 56, 52, 46].map((h, i) => (
          <span
            key={i}
            className="w-[9px]"
            style={{ height: h, background: 'linear-gradient(90deg, var(--marble), var(--marble-deep))' }}
          />
        ))}
      </div>
      <div
        className="absolute bottom-[calc(62%+56px)] left-1/2 h-[10px] w-[104px] -translate-x-1/2"
        style={{ background: 'var(--marble)' }}
      />
      <div
        className="absolute bottom-[calc(62%+66px)] left-1/2 h-0 w-0 -translate-x-1/2"
        style={{ borderLeft: '60px solid transparent', borderRight: '60px solid transparent', borderBottom: '22px solid #e7dcc0' }}
      />

      {/* --- the altar: primary tap target --- */}
      <div
        className="glowpulse absolute left-1/2 top-[52%] h-[150px] w-[150px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(184,137,47,.5), transparent 70%)' }}
      />
      <button
        className="pointer-events-auto absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-[92px] text-center disabled:opacity-70"
        onClick={channel}
        disabled={!dispatch.canFire}
        aria-label={dispatch.canFire ? 'Channel the lightning' : 'Charging'}
      >
        <span
          className={`bolt-shape mx-auto block h-16 w-10 ${dispatch.canFire ? 'flick floaty' : ''}`}
          style={{
            background: 'linear-gradient(#ffe08a, var(--amber))',
            filter: dispatch.canFire
              ? 'drop-shadow(0 0 14px rgba(184,137,47,.9))'
              : 'grayscale(.5) opacity(.55)',
          }}
        />
      </button>
      {/* plinth, two tiers */}
      <div
        className="absolute left-1/2 top-[52%] h-[30px] w-[76px] -translate-x-1/2"
        style={{ background: 'linear-gradient(var(--marble), #cbb98f)', clipPath: 'polygon(14% 0, 86% 0, 100% 100%, 0 100%)' }}
      />
      <div
        className="absolute left-1/2 top-[calc(52%+26px)] h-4 w-24 -translate-x-1/2"
        style={{ background: '#bda879', clipPath: 'polygon(10% 0, 90% 0, 100% 100%, 0 100%)' }}
      />
      <div
        className="absolute left-1/2 top-[calc(52%+46px)] -translate-x-1/2 whitespace-nowrap font-mono text-[8px] font-semibold"
        style={{ letterSpacing: '.16em', color: '#6c6144' }}
      >
        {dispatch.canFire ? 'TAP TO CHANNEL ⚡' : `CHARGING ${Math.floor(dispatch.charge * 100)}%`}
      </div>

      {/* rising +CR from a channel */}
      {pops.map((p) => (
        <div
          key={p.id}
          className="rise absolute font-mono text-[13px] font-bold text-volt"
          style={{ left: `${p.x}%`, top: '46%' }}
        >
          +{formatShort(Math.round(p.amount))} CR
        </div>
      ))}

      {/* power-source installations, driven by the real buildout */}
      {built[0] && (
        <div className="absolute bottom-[26%] left-8">
          <div
            className="h-[26px] w-10 rounded"
            style={{ background: 'linear-gradient(var(--marble-deep), #a8946b)', boxShadow: '0 4px 8px rgba(0,0,0,.18)' }}
          />
          <div
            className="absolute -top-[9px] left-1.5 h-3 w-7 rounded-[3px]"
            style={{ background: 'linear-gradient(90deg, var(--amber-dim), var(--amber))', boxShadow: '0 0 8px rgba(184,137,47,.6)' }}
          />
          <div className="mt-1 text-center font-mono text-[8px] font-semibold" style={{ color: '#6c6144' }}>
            {built[0].name.split(' ')[0]} ×{built[0].owned}
          </div>
        </div>
      )}
      {built[1] && (
        <div className="absolute bottom-[29%] right-10">
          <div
            className="h-[30px] w-11 rounded"
            style={{ background: 'linear-gradient(#c4b287, #9e8a62)', boxShadow: '0 4px 8px rgba(0,0,0,.18)' }}
          />
          <div className="absolute -top-[14px] left-[14px] h-4 w-[5px] rounded-sm" style={{ background: '#7a6c50' }} />
          <div
            className="smoke absolute -top-6 left-[14px] h-1.5 w-1.5 rounded-full"
            style={{ background: 'rgba(120,110,90,.5)' }}
          />
          <div className="mt-1 text-center font-mono text-[8px] font-semibold" style={{ color: '#6c6144' }}>
            {built[1].name.split(' ')[0]} ×{built[1].owned}
          </div>
        </div>
      )}

      {/* the cats */}
      <Cat
        className="floaty bottom-[28%] left-24 scale-105"
        body="#54493d"
        bodyDeep="#2b241d"
        ear="#443a30"
        tail="#3a3229"
        eye="#e9c25a"
      />
      <Cat
        className="bottom-[24%] right-24 scale-[.82]"
        body="#8a7458"
        bodyDeep="#5c4a36"
        ear="#6f5a42"
        tail="#5a4a3a"
        eye="#7fd0c0"
        flip
        delay={0.8}
      />
    </div>
  );
}
