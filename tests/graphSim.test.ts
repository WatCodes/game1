import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  initialLayout,
  reconcile,
  settle,
  step,
  type SimEdge,
  type SimNode,
} from '../src/ui/graph/simulation';

function seedFor(count: number): Omit<SimNode, 'x' | 'y' | 'vx' | 'vy'>[] {
  return Array.from({ length: count }, (_, i) => ({ id: `n${i}`, tier: i % 3 }));
}

describe('initialLayout', () => {
  it('assigns finite positions to every node', () => {
    const nodes = initialLayout(seedFor(20));
    for (const n of nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it('separates tiers by radius (higher tier is further out)', () => {
    const nodes = initialLayout(seedFor(30));
    const radiusByTier = new Map<number, number[]>();
    for (const n of nodes) {
      const r = Math.hypot(n.x, n.y);
      const arr = radiusByTier.get(n.tier) ?? [];
      arr.push(r);
      radiusByTier.set(n.tier, arr);
    }
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    expect(avg(radiusByTier.get(0)!)).toBeLessThan(avg(radiusByTier.get(1)!));
    expect(avg(radiusByTier.get(1)!)).toBeLessThan(avg(radiusByTier.get(2)!));
  });
});

describe('step', () => {
  function twoNodes(dist: number): SimNode[] {
    return [
      { id: 'a', tier: 0, x: -dist / 2, y: 0, vx: 0, vy: 0 },
      { id: 'b', tier: 0, x: dist / 2, y: 0, vx: 0, vy: 0 },
    ];
  }
  const noJitter = { ...DEFAULT_CONFIG, jitter: 0 };

  it('two disconnected nodes repel and drift apart', () => {
    const nodes = twoNodes(10);
    const startDist = 10;
    for (let i = 0; i < 40; i++) step(nodes, [], noJitter);
    const endDist = Math.abs(nodes[1].x - nodes[0].x);
    expect(endDist).toBeGreaterThan(startDist);
  });

  it('a spring pulls edge-connected nodes toward its rest length', () => {
    const nodes = twoNodes(400); // way stretched
    const edges: SimEdge[] = [{ from: 'a', to: 'b' }];
    for (let i = 0; i < 400; i++) step(nodes, edges, noJitter);
    const endDist = Math.abs(nodes[1].x - nodes[0].x);
    // Spring pulls them together against repulsion — settled distance
    // sits somewhere between fully-tight and fully-loose but well below
    // where it started (400) and clearly above zero.
    expect(endDist).toBeLessThan(300);
    expect(endDist).toBeGreaterThan(10);
  });

  it('a pinned node stays put no matter the forces', () => {
    const nodes = twoNodes(20);
    nodes[0].pinned = true;
    const startX = nodes[0].x;
    for (let i = 0; i < 50; i++) step(nodes, [], noJitter);
    expect(nodes[0].x).toBe(startX);
    expect(nodes[0].vx).toBe(0);
    expect(nodes[0].vy).toBe(0);
  });

  it('positions never explode under 1000 steps at DEFAULT_CONFIG', () => {
    const nodes = initialLayout(seedFor(50));
    const edges: SimEdge[] = nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }));
    for (let i = 0; i < 1000; i++) step(nodes, edges, DEFAULT_CONFIG);
    for (const n of nodes) {
      expect(Math.abs(n.x)).toBeLessThan(10_000);
      expect(Math.abs(n.y)).toBeLessThan(10_000);
      expect(Number.isFinite(n.vx)).toBe(true);
      expect(Number.isFinite(n.vy)).toBe(true);
    }
  });

  it('empty input is a no-op', () => {
    expect(step([], [], DEFAULT_CONFIG)).toBe(0);
  });

  it('edges to missing nodes are silently skipped', () => {
    const nodes = twoNodes(20);
    const edges: SimEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'ghost' },
      { from: 'ghost', to: 'b' },
    ];
    // shouldn't throw or produce NaN
    for (let i = 0; i < 20; i++) step(nodes, edges, noJitter);
    expect(Number.isFinite(nodes[0].x)).toBe(true);
    expect(Number.isFinite(nodes[1].x)).toBe(true);
  });
});

describe('settle', () => {
  it('produces a bounded, jitter-free result', () => {
    const nodes = initialLayout(seedFor(30));
    const edges: SimEdge[] = nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }));
    settle(nodes, edges, DEFAULT_CONFIG, 200);
    // After settling with jitter=0, velocities should be tiny.
    for (const n of nodes) {
      expect(Math.abs(n.vx)).toBeLessThan(1);
      expect(Math.abs(n.vy)).toBeLessThan(1);
    }
  });
});

describe('reconcile', () => {
  it('preserves positions for existing nodes', () => {
    const prev: SimNode[] = [
      { id: 'a', tier: 0, x: 10, y: 20, vx: 1, vy: 2 },
      { id: 'b', tier: 0, x: 30, y: 40, vx: 0, vy: 0 },
    ];
    const next = reconcile(prev, [
      { id: 'a', tier: 0 },
      { id: 'b', tier: 0 },
    ]);
    expect(next[0]).toMatchObject({ id: 'a', x: 10, y: 20, vx: 1, vy: 2 });
    expect(next[1]).toMatchObject({ id: 'b', x: 30, y: 40 });
  });

  it('spawns new nodes near the centroid of their tier', () => {
    const prev: SimNode[] = [
      { id: 'a', tier: 1, x: 100, y: 100, vx: 0, vy: 0 },
      { id: 'b', tier: 1, x: 120, y: 100, vx: 0, vy: 0 },
    ];
    const next = reconcile(prev, [
      { id: 'a', tier: 1 },
      { id: 'b', tier: 1 },
      { id: 'c', tier: 1 }, // new
    ]);
    const c = next.find((n) => n.id === 'c')!;
    // centroid ≈ (110, 100), new node spawns within ±20 of that
    expect(Math.abs(c.x - 110)).toBeLessThan(25);
    expect(Math.abs(c.y - 100)).toBeLessThan(25);
  });

  it('drops removed nodes and keeps the ordering of the new seed', () => {
    const prev: SimNode[] = [
      { id: 'a', tier: 0, x: 0, y: 0, vx: 0, vy: 0 },
      { id: 'b', tier: 0, x: 0, y: 0, vx: 0, vy: 0 },
      { id: 'c', tier: 0, x: 0, y: 0, vx: 0, vy: 0 },
    ];
    const next = reconcile(prev, [
      { id: 'c', tier: 0 },
      { id: 'a', tier: 0 },
    ]);
    expect(next.map((n) => n.id)).toEqual(['c', 'a']);
  });

  it('handles a fresh sim with no prior positions', () => {
    const next = reconcile([], [{ id: 'x', tier: 2 }]);
    expect(next).toHaveLength(1);
    expect(Number.isFinite(next[0].x)).toBe(true);
    expect(Number.isFinite(next[0].y)).toBe(true);
  });

  it('updates the tier of an existing node without breaking position', () => {
    const prev: SimNode[] = [{ id: 'a', tier: 0, x: 5, y: 5, vx: 0, vy: 0 }];
    const next = reconcile(prev, [{ id: 'a', tier: 3 }]);
    expect(next[0]).toMatchObject({ id: 'a', tier: 3, x: 5, y: 5 });
  });
});
