import { describe, expect, it } from 'vitest';
import {
  conns,
  generatePuzzle,
  isSolved,
  poweredSet,
  puzzleReward,
  puzzleSize,
  rotateTile,
  runSolvers,
  scramblePuzzle,
  type SolveResult,
} from '../src/engine/puzzle';
import { createInitialState } from '../src/engine/state';
import { CONFIG } from '../src/content/config';
import type { PuzzleState } from '../src/engine/types';

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

function key(dirs: number[]): string {
  return [...dirs].sort().join('');
}

/** Rotate every tile until it matches the captured solution orientation. */
function solve(p: PuzzleState, solution: number[]): void {
  p.tiles.forEach((t, i) => {
    const want = key(conns({ ...t, rot: solution[i] }));
    for (let k = 0; k < 4 && key(conns(t)) !== want; k++) t.rot = (t.rot + 1) % 4;
  });
}

describe('generator', () => {
  it('produces a fully-connected solved circuit with one source', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const p = generatePuzzle(0, mulberry32(seed));
      expect(isSolved(p)).toBe(true);
      expect(p.tiles.filter((t) => t.role === 'source')).toHaveLength(1);
      expect(p.tiles.filter((t) => t.role === 'sink').length).toBeGreaterThan(0);
      // spanning tree: every tile is on the circuit in solved orientation
      expect(poweredSet(p).size).toBe(p.size * p.size);
    }
  });

  it('scrambling always leaves the puzzle unsolved with a positive par', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const rand = mulberry32(seed);
      const p = generatePuzzle(0, rand);
      scramblePuzzle(p, rand);
      expect(isSolved(p)).toBe(false);
      expect(p.par).toBeGreaterThan(0);
    }
  });

  it('scrambled puzzles are solvable by returning to the solution', () => {
    const rand = mulberry32(42);
    const p = generatePuzzle(0, rand);
    const solution = p.tiles.map((t) => t.rot);
    scramblePuzzle(p, rand);
    solve(p, solution);
    expect(isSolved(p)).toBe(true);
  });

  it('grids grow with tier and cap at 7', () => {
    expect(puzzleSize(0)).toBe(4);
    expect(puzzleSize(2)).toBe(5);
    expect(puzzleSize(6)).toBe(7);
    expect(puzzleSize(12)).toBe(7);
  });
});

describe('rotateTile', () => {
  function solvableState() {
    const rand = mulberry32(7);
    const s = createInitialState(0, rand);
    const p = generatePuzzle(0, rand);
    const solution = p.tiles.map((t) => t.rot);
    scramblePuzzle(p, rand);
    s.puzzle = p;
    return { s, solution };
  }

  it('pays credits and lights the surge on solve, then latches', () => {
    const { s, solution } = solvableState();
    // rotate every tile to solution via the engine action
    let result: SolveResult | null = null;
    s.puzzle.tiles.forEach((t, i) => {
      const want = key(conns({ ...t, rot: solution[i] }));
      for (let k = 0; k < 4 && key(conns(t)) !== want; k++) {
        result = rotateTile(s, i) ?? result;
      }
    });
    expect(result).not.toBeNull();
    expect(s.puzzle.solved).toBe(true);
    expect(s.credits).toBeGreaterThan(0);
    expect(s.boosts.surgeLeft).toBe(CONFIG.SURGE_MANUAL_SECONDS);
    expect(s.stats.puzzlesSolved).toBe(1);
    // latched: further rotations are ignored
    const before = s.puzzle.tiles[0].rot;
    expect(rotateTile(s, 0)).toBeNull();
    expect(s.puzzle.tiles[0].rot).toBe(before);
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
    runSolvers(s, CONFIG.SOLVER_SECONDS); // 2 solves banked
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
