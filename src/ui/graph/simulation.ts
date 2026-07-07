// Force-directed layout for the research graph — hand-rolled, no dependency.
// One RAF frame per step; the whole tree is ~70 nodes at max tier, so the
// n² pairwise repulsion is well under 10 000 ops/frame — fine on mobile.

export interface SimNode {
  id: string;
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned?: boolean; // set while the user is dragging this node
}

export interface SimEdge {
  from: string;
  to: string;
}

export interface SimConfig {
  repulsion: number;
  springLength: number;
  springStiffness: number;
  damping: number;
  centerPull: number;
  jitter: number; // brownian noise — keeps the graph gently alive at rest
  maxSpeed: number;
}

/**
 * Tuned for the ~70-node tree at 60 fps: repulsion strong enough to keep
 * labels legible without exploding on tier 0's ten nodes; damping high so
 * dragging a node doesn't send the neighbors flying.
 */
export const DEFAULT_CONFIG: SimConfig = {
  repulsion: 2600,
  springLength: 78,
  springStiffness: 0.022,
  damping: 0.86,
  centerPull: 0.0015,
  jitter: 0.055,
  maxSpeed: 6,
};

/** Radial fan by tier so nodes never start on top of each other. */
export function initialLayout(seed: Omit<SimNode, 'x' | 'y' | 'vx' | 'vy'>[]): SimNode[] {
  const counts = new Map<number, number>();
  for (const n of seed) counts.set(n.tier, (counts.get(n.tier) ?? 0) + 1);
  const idx = new Map<number, number>();
  return seed.map((n) => {
    const i = idx.get(n.tier) ?? 0;
    idx.set(n.tier, i + 1);
    const count = counts.get(n.tier) ?? 1;
    // Fan each tier around its own arc so prereq lines don't cross wildly.
    const angle = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = 40 + n.tier * 95;
    return {
      ...n,
      x: radius * Math.cos(angle) + (Math.random() - 0.5) * 18,
      y: radius * Math.sin(angle) + (Math.random() - 0.5) * 18,
      vx: 0,
      vy: 0,
    };
  });
}

/** Advance one step; mutates node positions. Returns total kinetic energy. */
export function step(nodes: SimNode[], edges: SimEdge[], config: SimConfig): number {
  const n = nodes.length;
  if (n === 0) return 0;

  const fx = new Float32Array(n);
  const fy = new Float32Array(n);

  // Pairwise repulsion (Coulomb-ish; 1/r² falloff). Softened at r → 0.
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const r2 = dx * dx + dy * dy + 4; // soften to avoid singularity
      const invR = 1 / Math.sqrt(r2);
      const f = config.repulsion / r2;
      const ux = dx * invR;
      const uy = dy * invR;
      fx[i] -= f * ux;
      fy[i] -= f * uy;
      fx[j] += f * ux;
      fy[j] += f * uy;
    }
  }

  // Spring attraction along prereq edges (Hooke). Softened rest length.
  const byId = new Map<string, number>();
  for (let i = 0; i < n; i++) byId.set(nodes[i].id, i);
  for (const e of edges) {
    const i = byId.get(e.from);
    const j = byId.get(e.to);
    if (i === undefined || j === undefined) continue;
    const dx = nodes[j].x - nodes[i].x;
    const dy = nodes[j].y - nodes[i].y;
    const r = Math.sqrt(dx * dx + dy * dy) || 1;
    const stretch = r - config.springLength;
    const f = config.springStiffness * stretch;
    const ux = dx / r;
    const uy = dy / r;
    fx[i] += f * ux;
    fy[i] += f * uy;
    fx[j] -= f * ux;
    fy[j] -= f * uy;
  }

  // Integrate: weak centering pull + damping + tiny brownian jitter, clamped.
  let energy = 0;
  for (let i = 0; i < n; i++) {
    const p = nodes[i];
    if (p.pinned) {
      p.vx = 0;
      p.vy = 0;
      continue;
    }
    p.vx = (p.vx + fx[i] - config.centerPull * p.x) * config.damping;
    p.vy = (p.vy + fy[i] - config.centerPull * p.y) * config.damping;
    p.vx += (Math.random() - 0.5) * config.jitter;
    p.vy += (Math.random() - 0.5) * config.jitter;
    if (p.vx > config.maxSpeed) p.vx = config.maxSpeed;
    else if (p.vx < -config.maxSpeed) p.vx = -config.maxSpeed;
    if (p.vy > config.maxSpeed) p.vy = config.maxSpeed;
    else if (p.vy < -config.maxSpeed) p.vy = -config.maxSpeed;
    p.x += p.vx;
    p.y += p.vy;
    energy += p.vx * p.vx + p.vy * p.vy;
  }
  return energy;
}

/** Deterministic settle used for prefers-reduced-motion. */
export function settle(nodes: SimNode[], edges: SimEdge[], config: SimConfig, iterations = 300): void {
  const cfg = { ...config, jitter: 0 };
  for (let i = 0; i < iterations; i++) step(nodes, edges, cfg);
}

/**
 * Merge a new seed into an existing sim: preserve positions/velocities for
 * nodes we've already laid out, fresh-spawn any new nodes near their tier
 * radius. Order-preserving so the caller's edge indices stay valid.
 */
export function reconcile(prev: SimNode[], next: Omit<SimNode, 'x' | 'y' | 'vx' | 'vy'>[]): SimNode[] {
  const byId = new Map<string, SimNode>();
  for (const p of prev) byId.set(p.id, p);
  return next.map((seed) => {
    const existing = byId.get(seed.id);
    if (existing) return { ...existing, tier: seed.tier };
    // New node — drop it near the centroid of its tier if any, else radial.
    const sameTier = prev.filter((p) => p.tier === seed.tier);
    if (sameTier.length > 0) {
      const cx = sameTier.reduce((s, n) => s + n.x, 0) / sameTier.length;
      const cy = sameTier.reduce((s, n) => s + n.y, 0) / sameTier.length;
      return {
        ...seed,
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      };
    }
    return initialLayout([seed])[0];
  });
}
