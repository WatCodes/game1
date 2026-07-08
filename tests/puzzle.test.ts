import { describe, expect, it } from 'vitest';
import { affectedCells, isSolved, newPuzzle, puzzleReward, puzzleSize, runSolvers, tapCell } from '../src/engine/puzzle';
import { createInitialState } from '../src/engine/state';
import { CONFIG } from '../src/content/config';
import type { GameState } from '../src/engine/types';

/** Deterministic PRNG so generator tests are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('newPuzzle (load balancer)', () => {
  it('deals a solvable but not-yet-balanced board with a positive par', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const p = newPuzzle(0, mulberry32(seed));
      expect(p.cells).toHaveLength(p.size * p.size);
      expect(isSolved(p)).toBe(false); // never hand a pre-balanced board
      expect(p.par).toBeGreaterThan(0);
    }
  });

  it('grids grow with tier and cap at 7', () => {
    expect(puzzleSize(0)).toBe(4);
    expect(puzzleSize(2)).toBe(5);
    expect(puzzleSize(6)).toBe(7);
    expect(puzzleSize(12)).toBe(7);
  });
});

describe('affectedCells', () => {
  it('a corner tap affects 3 cells, an edge 4, an interior 5', () => {
    const size = 4;
    expect(affectedCells(0, size).sort((a, b) => a - b)).toEqual([0, 1, 4]); // top-left corner
    expect(affectedCells(1, size)).toContain(1); // top edge → self + 3 neighbors
    expect(affectedCells(1, size)).toHaveLength(4);
    expect(affectedCells(5, size)).toHaveLength(5); // interior → self + 4
  });
});

describe('tapCell', () => {
  /** Deterministic solver: light-chase then handle the board directly. Since
   *  our boards are small and always solvable, we brute-force via BFS over the
   *  toggle group would be overkill — instead we replay a known solution by
   *  tapping every cell whose tap is in the minimal set. We derive that set by
   *  solving the board here with Gaussian elimination over GF(2). */
  function solveBoard(s: GameState): number {
    const p = s.puzzle;
    const n = p.cells.length;
    const size = p.size;
    // Build the toggle matrix A (n×n) and target b (current lit state).
    const rows: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row = new Array(n + 1).fill(0);
      for (const c of affectedCells(i, size)) row[c] = 1;
      row[n] = p.cells[i] ? 1 : 0;
      rows.push(row);
    }
    // Gaussian elimination mod 2.
    let r = 0;
    const where = new Array(n).fill(-1);
    for (let col = 0; col < n && r < n; col++) {
      let sel = -1;
      for (let i = r; i < n; i++) if (rows[i][col]) { sel = i; break; }
      if (sel === -1) continue;
      [rows[r], rows[sel]] = [rows[sel], rows[r]];
      for (let i = 0; i < n; i++) {
        if (i !== r && rows[i][col]) for (let j = col; j <= n; j++) rows[i][j] ^= rows[r][j];
      }
      where[col] = r;
      r++;
    }
    const x = new Array(n).fill(0);
    for (let col = 0; col < n; col++) if (where[col] !== -1) x[col] = rows[where[col]][n];
    let taps = 0;
    for (let i = 0; i < n; i++) if (x[i]) { tapCell(s, i); taps++; }
    return taps;
  }

  it('balancing the grid pays credits, lights the surge, and latches', () => {
    const s = createInitialState(0, mulberry32(7));
    s.puzzle = newPuzzle(0, mulberry32(7));
    solveBoard(s);
    expect(s.puzzle.solved).toBe(true);
    expect(isSolved(s.puzzle)).toBe(true);
    expect(s.credits).toBeGreaterThan(0);
    expect(s.boosts.surgeLeft).toBe(CONFIG.SURGE_MANUAL_SECONDS);
    expect(s.stats.puzzlesSolved).toBe(1);
    // latched: further taps are ignored
    const before = [...s.puzzle.cells];
    expect(tapCell(s, 0)).toBeNull();
    expect(s.puzzle.cells).toEqual(before);
  });

  it('a tap flips the district and its orthogonal neighbors', () => {
    const s = createInitialState(0);
    s.puzzle = { tier: 0, size: 4, cells: new Array(16).fill(false), moves: 0, par: 1, solved: false };
    tapCell(s, 5); // interior
    for (const c of affectedCells(5, 4)) expect(s.puzzle.cells[c]).toBe(true);
    expect(s.puzzle.cells[0]).toBe(false); // untouched
  });
});

describe('rewards', () => {
  it('scales with tier and pays the efficiency bonus near par', () => {
    const base = CONFIG.PUZZLE_BASE_REWARD;
    expect(puzzleReward(0, 100, 10)).toBe(base);
    expect(puzzleReward(0, 10, 10)).toBe(Math.round(base * CONFIG.PUZZLE_BONUS_MULT));
    expect(puzzleReward(0, 12, 10)).toBe(Math.round(base * CONFIG.PUZZLE_BONUS_MULT)); // slack
    expect(puzzleReward(3, 100, 10)).toBe(base + 3 * CONFIG.PUZZLE_TIER_REWARD);
  });
});

describe('auto-solvers', () => {
  it('grind solves for reduced credits and short surges', () => {
    const s = createInitialState(0, mulberry32(1));
    s.solvers = 2;
    runSolvers(s, CONFIG.SOLVER_SECONDS);
    const per = Math.round(CONFIG.PUZZLE_BASE_REWARD * CONFIG.SOLVER_REWARD_FACTOR);
    expect(s.credits).toBe(2 * per);
    expect(s.boosts.surgeLeft).toBe(2 * CONFIG.SURGE_AUTO_SECONDS);
    expect(s.stats.puzzlesSolved).toBe(2);
  });

  it('banks fractional progress between ticks', () => {
    const s = createInitialState(0, mulberry32(1));
    s.solvers = 1;
    runSolvers(s, CONFIG.SOLVER_SECONDS / 2);
    expect(s.credits).toBe(0);
    expect(s.solverProgress).toBeCloseTo(0.5);
    runSolvers(s, CONFIG.SOLVER_SECONDS / 2);
    expect(s.stats.puzzlesSolved).toBe(1);
  });

  it('surge is capped', () => {
    const s = createInitialState(0, mulberry32(1));
    s.solvers = 1000;
    runSolvers(s, CONFIG.SOLVER_SECONDS);
    expect(s.boosts.surgeLeft).toBe(CONFIG.SURGE_CAP_SECONDS);
  });
});
