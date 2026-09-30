import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { MOMENT_ORDER, MOMENTS, type MomentId } from '../../content/tutorial';

/**
 * Sequences the tutorial moments and draws them. Design: docs/TUTORIAL.md.
 *
 * The engine says which moments the *state* calls for; this layer adds what the
 * state cannot know — what this device has already shown, and whether the screen
 * is free. One moment at a time, never on top of another overlay, each shown once.
 */

const SEEN_KEY = 'kardashev:ui:moments';

function readSeen(): Set<MomentId> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as MomentId[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<MomentId>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Private mode or full storage: the beat may show again next launch. Harmless.
  }
}

/** A rect relative to the layer, so positions survive the centred max-w-md frame. */
interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  frameW: number;
  frameH: number;
}

/**
 * Whether a control can actually be seen and tapped — not merely present.
 *
 * Being in the DOM is not enough. The power-sources sheet slides over the
 * courtyard and the rail, so in playtesting the altar beat fired while the sheet
 * was still open and drew its ring over the sheet, pointing at an altar nobody
 * could see. So the control must be the topmost thing at its own centre; if
 * anything covers it, the beat waits until it is uncovered. The tutorial layer
 * itself is pointer-events: none, so it never counts as covering.
 */
function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!top && (top === el || el.contains(top));
}

/**
 * Track a `data-tutorial` element's position. Polled rather than observed: the
 * anchors move with sheets opening, panels animating and the viewport resizing,
 * and a 200ms poll of one rect is cheaper to reason about than four observers.
 */
function useAnchorBox(anchors: string[] | null, frame: React.RefObject<HTMLDivElement>): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  const key = anchors?.join('|') ?? '';

  useEffect(() => {
    if (!anchors) {
      setBox(null);
      return;
    }
    const measure = () => {
      const host = frame.current?.getBoundingClientRect();
      const el = anchors
        .map((a) => document.querySelector(`[data-tutorial="${a}"]`))
        .find((e): e is Element => !!e && isVisible(e));
      if (!host || !el) {
        setBox(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setBox((prev) => {
        const next = {
          top: r.top - host.top,
          left: r.left - host.left,
          width: r.width,
          height: r.height,
          frameW: host.width,
          frameH: host.height,
        };
        const same =
          prev &&
          Math.abs(prev.top - next.top) < 1 &&
          Math.abs(prev.left - next.left) < 1 &&
          Math.abs(prev.width - next.width) < 1 &&
          Math.abs(prev.frameH - next.frameH) < 1;
        return same ? prev : next;
      });
    };
    measure();
    const t = window.setInterval(measure, 200);
    return () => window.clearInterval(t);
    // `key` stands in for `anchors`, which is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, frame]);

  return box;
}

export function TutorialLayer({ blocked }: { blocked: boolean }) {
  const tutorial = useGame((s) => s.display.tutorial);
  const dispatchCount = useGame((s) => s.display.dispatchCount);
  const [seen, setSeen] = useState<Set<MomentId>>(readSeen);
  const [current, setCurrent] = useState<{ id: MomentId; dispatchAt: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  const finish = (id: MomentId) => {
    setSeen((prev) => {
      const next = new Set(prev).add(id);
      writeSeen(next);
      return next;
    });
    setCurrent(null);
  };

  useEffect(() => {
    if (current) {
      const { id } = current;
      // Done: the player performed the action. The altar has no trace in state,
      // so it is done when a channel has fired since the beat appeared.
      const done =
        MOMENTS[id].style === 'do' &&
        (tutorial.satisfied[id] || (id === 'altar' && dispatchCount > current.dispatchAt));
      if (done) {
        finish(id);
        return;
      }
      // No longer true (e.g. RP spent elsewhere, so "you can afford research" is
      // now false). Withdraw without marking seen; it returns when true again.
      if (!tutorial.due[id]) setCurrent(null);
      return;
    }
    // Never *start* a beat behind something else. One already showing merely
    // hides while blocked, and comes back.
    if (blocked) return;
    const next = MOMENT_ORDER.find((id) => !seen.has(id) && tutorial.due[id]);
    if (next) setCurrent({ id: next, dispatchAt: dispatchCount });
  }, [tutorial, dispatchCount, blocked, seen, current]);

  const moment = current ? MOMENTS[current.id] : null;
  // The credits beat points at the first source once the sheet is open, and at
  // the sheet's handle until then.
  const anchors = !moment || blocked ? null : current?.id === 'credits' ? ['first-source', moment.anchor] : [moment.anchor];
  const box = useAnchorBox(anchors, frame);

  return (
    <div ref={frame} className="pointer-events-none absolute inset-0 z-30">
      {moment && current && box && !blocked &&
        (moment.style === 'do' ? (
          <CoachMark box={box} copy={moment.copy} onDismiss={() => finish(current.id)} />
        ) : (
          <TellSpotlight box={box} copy={moment.copy} onDone={() => finish(current.id)} />
        ))}
    </div>
  );
}

const BUBBLE_W = 300;
const GAP = 14;

/** Where the bubble sits: opposite side of the anchor from the nearer edge. */
function bubblePlacement(box: Box) {
  const w = Math.min(BUBBLE_W, box.frameW - 32);
  const cx = box.left + box.width / 2;
  const left = Math.max(16, Math.min(cx - w / 2, box.frameW - w - 16));
  const below = box.top + box.height / 2 < box.frameH / 2;
  return below
    ? { left, width: w, top: box.top + box.height + GAP }
    : { left, width: w, bottom: box.frameH - box.top + GAP };
}

function Bubble({ copy, children }: { copy: string; children?: React.ReactNode }) {
  return (
    <>
      <div className="font-mono text-[10px] font-semibold" style={{ letterSpacing: '.24em', color: 'var(--danger)' }}>
        PYRRHA · KEEPER OF THE FLAME
      </div>
      <div className="mt-1 font-body text-[13px] font-medium leading-[1.45]">{copy}</div>
      {children}
    </>
  );
}

/**
 * A `do` beat. No scrim, nothing blocking: the whole game stays usable, so
 * nobody can be trapped behind it. It simply stays until the action is done.
 */
function CoachMark({ box, copy, onDismiss }: { box: Box; copy: string; onDismiss: () => void }) {
  const pad = 6;
  return (
    <>
      <div
        className="absolute animate-pulse rounded-2xl"
        style={{
          top: box.top - pad,
          left: box.left - pad,
          width: box.width + pad * 2,
          height: box.height + pad * 2,
          border: '2px solid var(--amber)',
          boxShadow: '0 0 18px rgba(184,137,47,.55)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-auto absolute rounded-2xl border border-line py-3 pl-4 pr-9"
        style={{
          ...bubblePlacement(box),
          background: 'var(--bg-panel)',
          boxShadow: '0 12px 32px rgba(0,0,0,.25)',
        }}
        role="status"
        aria-live="polite"
      >
        <Bubble copy={copy} />
        <button
          className="absolute right-2 top-2 rounded px-1.5 py-0.5 font-mono text-[13px] leading-none text-ink-dim hover:text-ink"
          onClick={onDismiss}
          aria-label="Dismiss tip"
        >
          ✕
        </button>
      </div>
    </>
  );
}

/** A `tell` beat: the intro's spotlight, pointed at a real control. Tap to go on. */
function TellSpotlight({ box, copy, onDone }: { box: Box; copy: string; onDone: () => void }) {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const r = Math.max(box.width, box.height) * 1.3 + 30;
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  return (
    <div className="pointer-events-auto absolute inset-0" role="dialog" aria-modal="true" onClick={onDone}>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle ${r}px at ${cx}px ${cy}px, rgba(44,35,24,0) 0%, rgba(44,35,24,0) 62%, rgba(44,35,24,.62) 100%)`,
        }}
      />
      <div
        className="absolute rounded-2xl border border-line px-4 py-3"
        style={{ ...bubblePlacement(box), background: 'var(--bg-panel)', boxShadow: '0 12px 32px rgba(0,0,0,.3)' }}
      >
        <Bubble copy={copy}>
          <button ref={btn} className="mt-2 font-mono text-[10px] font-semibold text-ink-dim" onClick={onDone}>
            GOT IT ▸
          </button>
        </Bubble>
      </div>
    </div>
  );
}
