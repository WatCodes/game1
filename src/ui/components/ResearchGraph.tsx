import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { formatShort } from '../../engine/format';
import { DEFAULT_CONFIG, reconcile, settle, step, type SimEdge, type SimNode } from '../graph/simulation';

interface Viewport {
  tx: number;
  ty: number;
  scale: number;
}

// Default a touch zoomed-in: at scale 1 the whole 800-unit viewBox shrinks to
// ~380px on a phone, leaving node dots ~8px across. 1.3 renders them big enough
// to aim a thumb at; pinch/wheel/center still reach the full tree.
const DEFAULT_VIEWPORT: Viewport = { tx: 0, ty: 0, scale: 1.3 };
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.2;
const DRAG_THRESHOLD = 6; // pixels of pointer movement before we treat as pan/drag

interface PointerState {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  target: 'node' | 'canvas';
  nodeId?: string;
  moved: boolean;
}

/**
 * The Lab: a live force-directed research graph. Nodes are colored by state,
 * edges follow prereqs. Physics runs continuously (per the design brief, not
 * a settle-once) with brownian jitter to keep the web alive; positions live
 * in a ref so the RAF loop doesn't storm React with re-renders.
 */
export function ResearchGraph() {
  const research = useGame((s) => s.display.research);
  const rp = useGame((s) => s.display.rp);
  const buyResearchNode = useGame((s) => s.actions.buyResearchNode);

  const svgRef = useRef<SVGSVGElement>(null);
  const worldGroupRef = useRef<SVGGElement>(null);
  // One `<g transform>` wraps halo + node circle, so a single attr write
  // moves both — cheaper than tracking two elements and keeps them locked.
  const nodeGroupRefs = useRef<Map<string, SVGGElement>>(new Map());
  const edgeElRefs = useRef<Map<string, SVGLineElement>>(new Map());
  const simRef = useRef<SimNode[]>([]);
  // The edge set lives in a ref so the RAF loop can read the latest without
  // being torn down on every store publish (~12 Hz). A stable RAF loop
  // matters: without this, `useEffect([edges])` re-creates the loop faster
  // than the accumulator can build up 16 ms of frame time.
  const edgesRef = useRef<SimEdge[]>([]);
  const rafRef = useRef<number | null>(null);
  const viewportRef = useRef<Viewport>({ ...DEFAULT_VIEWPORT });
  const pointersRef = useRef<Map<number, PointerState>>(new Map());
  const pinchStateRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);

  // Selection & UI state that DOES need React re-renders
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [affordableOnly, setAffordableOnly] = useState(false);

  const nodesById = useMemo(() => {
    const map = new Map(research.map((r) => [r.id, r]));
    return map;
  }, [research]);

  const selected = selectedId ? nodesById.get(selectedId) ?? null : null;

  // ---- sim node/edge derivation ---------------------------------------------
  // Signal that changes only when the set of visible research nodes changes
  // (ascension unlocks new tiers). Keeps stable positions across purchase toggles.
  const idsKey = useMemo(() => research.map((r) => r.id).sort().join('|'), [research]);

  const edges: SimEdge[] = useMemo(() => {
    const ids = new Set(research.map((r) => r.id));
    const out: SimEdge[] = [];
    for (const r of research) {
      for (const p of r.prereqs) {
        if (ids.has(p)) out.push({ from: p, to: r.id });
      }
    }
    return out;
  }, [research]);

  // Keep the ref up-to-date with the latest edge set; the RAF loop reads it.
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Rebuild sim state when the node set changes; preserve positions of
  // existing nodes and warm-start any new ones near their tier's centroid.
  useEffect(() => {
    const seed = research.map((r) => ({ id: r.id, tier: r.tier }));
    simRef.current = reconcile(simRef.current, seed);
    // If motion is disabled, deterministically settle so the graph shows
    // finished state on mount instead of an in-motion frame.
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settle(simRef.current, edgesRef.current, DEFAULT_CONFIG);
      writeDomFromSim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // ---- RAF loop -------------------------------------------------------------
  // Reads simRef and edgesRef; no closure deps, so the RAF loop can mount once
  // and keep running across store publishes.
  const writeDomFromSim = useCallback(() => {
    const byId = new Map<string, SimNode>();
    for (const n of simRef.current) {
      byId.set(n.id, n);
      const g = nodeGroupRefs.current.get(n.id);
      if (g) g.setAttribute('transform', `translate(${n.x.toFixed(2)}, ${n.y.toFixed(2)})`);
    }
    for (const e of edgesRef.current) {
      const line = edgeElRefs.current.get(`${e.from}->${e.to}`);
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!line || !a || !b) continue;
      line.setAttribute('x1', a.x.toFixed(2));
      line.setAttribute('y1', a.y.toFixed(2));
      line.setAttribute('x2', b.x.toFixed(2));
      line.setAttribute('y2', b.y.toFixed(2));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      writeDomFromSim();
      return; // no loop — layout is settled once and static
    }
    let last = performance.now();
    let accum = 0;
    const STEP_MS = 1000 / 60; // fixed-timestep 60 Hz sim
    const frame = (now: number) => {
      accum += now - last;
      last = now;
      // Clamp on tab-away so we don't run 1000 catch-up steps.
      if (accum > 250) accum = 250;
      while (accum >= STEP_MS) {
        step(simRef.current, edgesRef.current, DEFAULT_CONFIG);
        accum -= STEP_MS;
      }
      writeDomFromSim();
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [writeDomFromSim]);

  // ---- pan / zoom / drag ----------------------------------------------------
  const applyViewport = useCallback(() => {
    const g = worldGroupRef.current;
    if (!g) return;
    const { tx, ty, scale } = viewportRef.current;
    g.setAttribute('transform', `translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) scale(${scale.toFixed(3)})`);
  }, []);

  useEffect(() => applyViewport(), [applyViewport]);

  /** Screen → SVG viewBox coords (independent of worldGroup transform). */
  const clientToViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = pt.matrixTransform(ctm.inverse());
    return { x: inv.x, y: inv.y };
  }, []);

  /** Screen → world (through worldGroup's transform). Used for node drag. */
  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const g = worldGroupRef.current;
    const svg = svgRef.current;
    if (!g || !svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = g.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = pt.matrixTransform(ctm.inverse());
    return { x: inv.x, y: inv.y };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* stale/synthetic pointerId — capture is an optimization, not a requirement */
    }
    const target = e.target as Element;
    const nodeEl = target.closest?.('[data-node-id]') as SVGCircleElement | null;
    const nodeId = nodeEl?.getAttribute('data-node-id') ?? undefined;
    pointersRef.current.set(e.pointerId, {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      target: nodeId ? 'node' : 'canvas',
      nodeId,
      moved: false,
    });
    // Second pointer down → start pinch tracking.
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      pinchStateRef.current = {
        dist: Math.hypot(dx, dy),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
    }
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const p = pointersRef.current.get(e.pointerId);
      if (!p) return;
      const prevClientX = p.x;
      const prevClientY = p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      const totalDx = e.clientX - p.startX;
      const totalDy = e.clientY - p.startY;
      if (!p.moved && Math.hypot(totalDx, totalDy) > DRAG_THRESHOLD) p.moved = true;

      // Two-finger pinch → zoom + pan around midpoint.
      if (pointersRef.current.size === 2 && pinchStateRef.current) {
        const [a, b] = [...pointersRef.current.values()];
        const newDist = Math.hypot(b.x - a.x, b.y - a.y);
        const newMidClient = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const oldMidVb = clientToViewBox(pinchStateRef.current.midX, pinchStateRef.current.midY);
        const scaleFactor = newDist / pinchStateRef.current.dist;
        const v = viewportRef.current;
        const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * scaleFactor));
        const actualFactor = nextScale / v.scale;
        // Keep the pinch midpoint anchored in viewBox space, then also
        // translate by however much the midpoint itself moved on screen.
        v.tx = oldMidVb.x - (oldMidVb.x - v.tx) * actualFactor;
        v.ty = oldMidVb.y - (oldMidVb.y - v.ty) * actualFactor;
        v.scale = nextScale;
        applyViewport();
        // Now account for the midpoint's screen translation.
        const newMidVb = clientToViewBox(newMidClient.x, newMidClient.y);
        const shiftedOldMidVb = clientToViewBox(pinchStateRef.current.midX, pinchStateRef.current.midY);
        v.tx += newMidVb.x - shiftedOldMidVb.x;
        v.ty += newMidVb.y - shiftedOldMidVb.y;
        pinchStateRef.current = { dist: newDist, midX: newMidClient.x, midY: newMidClient.y };
        applyViewport();
        return;
      }

      if (!p.moved) return;

      if (p.target === 'node' && p.nodeId) {
        // Drag a node: pin it, follow the pointer in world coords.
        const node = simRef.current.find((n) => n.id === p.nodeId);
        if (node) {
          node.pinned = true;
          const { x, y } = clientToWorld(e.clientX, e.clientY);
          node.x = x;
          node.y = y;
          node.vx = 0;
          node.vy = 0;
          writeDomFromSim();
        }
      } else {
        // Pan the canvas: convert the pixel delta to viewBox units by
        // subtracting two client-to-viewBox conversions. This is CTM-safe
        // regardless of preserveAspectRatio and container size.
        const prev = clientToViewBox(prevClientX, prevClientY);
        const curr = clientToViewBox(e.clientX, e.clientY);
        viewportRef.current.tx += curr.x - prev.x;
        viewportRef.current.ty += curr.y - prev.y;
        applyViewport();
      }
    },
    [applyViewport, clientToViewBox, clientToWorld, writeDomFromSim],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const p = pointersRef.current.get(e.pointerId);
    if (!p) return;
    pointersRef.current.delete(e.pointerId);
    pinchStateRef.current = null;
    if (!p.moved) {
      // Tap.
      setSelectedId(p.target === 'node' ? p.nodeId ?? null : null);
    } else if (p.target === 'node' && p.nodeId) {
      // Un-pin so physics reclaims the node.
      const node = simRef.current.find((n) => n.id === p.nodeId);
      if (node) node.pinned = false;
    }
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const v = viewportRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
      const actualFactor = nextScale / v.scale;
      // Keep the cursor's viewBox position fixed under the pointer.
      const cursor = clientToViewBox(e.clientX, e.clientY);
      v.tx = cursor.x - (cursor.x - v.tx) * actualFactor;
      v.ty = cursor.y - (cursor.y - v.ty) * actualFactor;
      v.scale = nextScale;
      applyViewport();
    },
    [applyViewport, clientToViewBox],
  );

  // ---- controls -------------------------------------------------------------
  const affordableCount = research.filter((r) => r.available && r.affordable).length;
  const projectCriticalCount = research.filter((r) => r.projectCritical).length;

  const resetView = () => {
    viewportRef.current = { ...DEFAULT_VIEWPORT };
    applyViewport();
  };

  // ---- render ---------------------------------------------------------------
  return (
    <div className="relative flex h-full flex-col">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line/60 px-3 py-2 text-[11px]">
        <span className="font-mono text-ink-dim">
          RP <span className="text-current">{formatShort(Math.floor(rp))}</span>
        </span>
        <span className="text-ink-dim">·</span>
        <span className="font-mono text-ink-dim">
          {research.filter((r) => r.purchased).length}/{research.length} researched
        </span>
        {projectCriticalCount > 0 && (
          <>
            <span className="text-ink-dim">·</span>
            <span className="font-mono text-ascend">{projectCriticalCount} blocks the build</span>
          </>
        )}
        <span className="flex-1" />
        <button
          className={`rounded border px-2 py-0.5 font-mono uppercase tracking-wider transition-colors ${
            affordableOnly
              ? 'border-volt text-volt'
              : 'border-line text-ink-dim hover:border-ink hover:text-ink'
          }`}
          onClick={() => setAffordableOnly((v) => !v)}
          aria-pressed={affordableOnly}
          title="Dim nodes you can't afford right now"
        >
          affordable ({affordableCount})
        </button>
        <button
          className="rounded border border-line px-2 py-0.5 font-mono uppercase tracking-wider text-ink-dim transition-colors hover:border-ink hover:text-ink"
          onClick={resetView}
          title="Recenter and reset zoom"
        >
          center
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          // viewBox centers (0, 0) in the middle. The browser scales to fit
          // the container; zoom becomes a scale on the world <g> below.
          viewBox="-400 -400 800 800"
          preserveAspectRatio="xMidYMid meet"
          className="block h-full w-full touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          role="application"
          aria-label="Research graph — pan to move, tap a node for details"
        >
          <g ref={worldGroupRef}>
            {/* Edges first so nodes sit on top */}
            {edges.map((e) => {
              const from = nodesById.get(e.from);
              const to = nodesById.get(e.to);
              const active = !!from?.purchased && !!to; // "live" line
              return (
                <line
                  key={`${e.from}->${e.to}`}
                  ref={(el) => {
                    if (el) edgeElRefs.current.set(`${e.from}->${e.to}`, el);
                    else edgeElRefs.current.delete(`${e.from}->${e.to}`);
                  }}
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={0}
                  stroke={active ? 'var(--cyan)' : 'var(--grid-line)'}
                  strokeWidth={active ? 1.2 : 0.9}
                  strokeOpacity={affordableOnly && !to?.affordable ? 0.15 : 0.7}
                />
              );
            })}
            {/* Nodes: one group per node, moved by transform so halo+circle
                stay atomically locked to the same position. */}
            {research.map((r) => {
              const dim = affordableOnly && !(r.available && r.affordable) && !r.purchased;
              const isSelected = r.id === selectedId;
              let fill = 'var(--bg-panel)';
              let stroke = 'var(--text-dim)';
              if (r.purchased) {
                fill = 'var(--cyan)';
                stroke = 'var(--cyan)';
              } else if (r.available && r.affordable) {
                fill = 'var(--amber)';
                stroke = 'var(--amber)';
              } else if (r.available) {
                fill = 'var(--bg-raised)';
                stroke = 'var(--cyan-dim)';
              }
              // A megaproject stage is gated behind this node — violet outranks
              // the affordability colours, since it answers "what unblocks my build?"
              if (r.projectCritical) stroke = 'var(--violet)';
              const radius = r.purchased ? 12 : r.available ? 12 : 8;
              return (
                <g
                  key={r.id}
                  ref={(el) => {
                    if (el) nodeGroupRefs.current.set(r.id, el);
                    else nodeGroupRefs.current.delete(r.id);
                  }}
                >
                  {/* Oversized transparent hit target — the visible dot is small
                      after the viewBox down-scale, so tapping it exactly is hard.
                      pointerEvents:all makes the whole disc tappable. */}
                  <circle
                    data-node-id={r.id}
                    cx={0}
                    cy={0}
                    r={30}
                    fill="transparent"
                    style={{ pointerEvents: 'all', cursor: 'pointer', touchAction: 'none' }}
                  />
                  {r.projectCritical && (
                    <circle
                      cx={0}
                      cy={0}
                      r={radius + 4}
                      fill="none"
                      stroke="var(--violet)"
                      strokeOpacity={0.75}
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  {isSelected && (
                    <circle cx={0} cy={0} r={radius + 6} fill="none" stroke="var(--cyan)" strokeOpacity={0.5} strokeWidth={2} style={{ pointerEvents: 'none' }} />
                  )}
                  <circle
                    cx={0}
                    cy={0}
                    r={radius}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={2}
                    opacity={dim ? 0.25 : 1}
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Detail card */}
        {selected && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
            <div className="glass-deep pointer-events-auto rounded-lg border border-line p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">
                  {selected.purchased && '✓ '}
                  {selected.name}
                </span>
                <span className="font-mono text-[11px] text-ink-dim">T{selected.tier}</span>
              </div>
              <p className="mt-1 text-xs text-ink-dim">{selected.desc}</p>
              {selected.projectCritical && (
                <p className="mt-1 text-[11px] text-ascend">⚡ A megaproject stage is locked behind this.</p>
              )}
              {selected.purchased ? (
                <p className="mt-1.5 text-[11px] text-ok">Complete.</p>
              ) : selected.missingPrereqs.length > 0 ? (
                <p className="mt-1.5 text-[11px] text-ink-dim">
                  Requires: {selected.missingPrereqs.join(', ')}
                </p>
              ) : (
                <button
                  className={`mt-2 w-full rounded border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                    selected.affordable
                      ? 'border-current-dim text-current hover:bg-raised'
                      : 'border-line text-ink-dim cursor-not-allowed'
                  }`}
                  disabled={!selected.affordable}
                  onClick={() => buyResearchNode(selected.id)}
                >
                  Research — {formatShort(selected.cost)} RP
                </button>
              )}
              <button
                className="mt-1.5 w-full rounded border border-line px-2 py-1 text-[10px] text-ink-dim transition-colors hover:border-ink hover:text-ink"
                onClick={() => setSelectedId(null)}
              >
                close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
