import { describe, expect, it } from 'vitest';
import {
  GREATER_THAN,
  LESS_THAN,
  clueDensity,
  conflictCells,
  givenFraction,
  isSolved,
  newPuzzle,
  puzzleReward,
  puzzleSize,
  runSolvers,
  tapCell,
} from '../src/engine/puzzle';
import { createInitialState } from '../src/engine/state';
import { CONFIG } from '../src/content/config';
import type { GameState, PuzzleState } from '../src/engine/types';

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

/**
 * Backtracking solver used only by the tests. Its job is to prove the generator
 * never deals an unsatisfiable board — the shipped game never solves for the
 * player, so this deliberately lives here rather than in the engine.
 */
function solve(p: PuzzleState): number[] | null {
  const { size } = p;
  const cells = [...p.cells];
  const across = (r: number, c: number) => p.across[r * (size - 1) + c];
  const down = (r: number, c: number) => p.down[r * size + c];

  const ok = (clue: number, a: number, b: number) =>
    !a || !b || clue === 0 || (clue === LESS_THAN ? a < b : a > b);

  const fits = (r: number, c: number, v: number): boolean => {
    for (let i = 0; i < size; i++) {
      if (i !== c && cells[r * size + i] === v) return false;
      if (i !== r && cells[i * size + c] === v) return false;
    }
    if (c > 0 && !ok(across(r, c - 1), cells[r * size + c - 1], v)) return false;
    if (c < size - 1 && !ok(across(r, c), v, cells[r * size + c + 1])) return false;
    if (r > 0 && !ok(down(r - 1, c), cells[(r - 1) * size + c], v)) return false;
    if (r < size - 1 && !ok(down(r, c), v, cells[(r + 1) * size + c])) return false;
    return true;
  };

  const recurse = (idx: number): boolean => {
    if (idx === cells.length) return true;
    if (p.givens[idx]) return recurse(idx + 1);
    const r = Math.floor(idx / size);
    const c = idx % size;
    for (let v = 1; v <= size; v++) {
      if (!fits(r, c, v)) continue;
      cells[idx] = v;
      if (recurse(idx + 1)) return true;
      cells[idx] = 0;
    }
    return false;
  };

  return recurse(0) ? cells : null;
}

const board = (over: Partial<PuzzleState> = {}): PuzzleState => ({
  tier: 0,
  size: 4,
  cells: new Array(16).fill(0),
  givens: new Array(16).fill(false),
  across: new Array(12).fill(0),
  down: new Array(12).fill(0),
  moves: 0,
  par: 1,
  solved: false,
  ...over,
});

const LATIN = [1, 2, 3, 4, 2, 3, 4, 1, 3, 4, 1, 2, 4, 1, 2, 3];

describe('newPuzzle (feeder balance)', () => {
  it('deals a satisfiable, unfinished board with a positive par', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const p = newPuzzle(0, mulberry32(seed));
      expect(p.cells).toHaveLength(p.size * p.size);
      expect(p.givens).toHaveLength(p.cells.length);
      expect(p.across).toHaveLength(p.size * (p.size - 1));
      expect(p.down).toHaveLength((p.size - 1) * p.size);
      expect(isSolved(p)).toBe(false); // never hand over a finished board
      expect(p.par).toBeGreaterThan(0);
      expect(solve(p)).not.toBeNull(); // clues can never contradict each other
    }
  });

  it('always leaves real work to do', () => {
    for (let tier = 0; tier <= 8; tier++) {
      const p = newPuzzle(tier, mulberry32(tier + 40));
      const blanks = p.givens.filter((g) => !g).length;
      expect(blanks).toBeGreaterThanOrEqual(Math.max(2, p.size));
    }
  });

  it('deals givens that sit on a real solution, so a board never starts wrong', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const p = newPuzzle(2, mulberry32(seed));
      p.cells.forEach((v, i) => expect(v === 0 || p.givens[i]).toBe(true));
      expect(conflictCells(p)).toEqual([]);
    }
  });

  it('boards grow with tier and cap at 7', () => {
    expect(puzzleSize(0)).toBe(4);
    expect(puzzleSize(2)).toBe(5);
    expect(puzzleSize(6)).toBe(7);
    expect(puzzleSize(12)).toBe(7);
  });

  it('gets harder with tier: fewer givens and fewer clues, both with floors', () => {
    expect(givenFraction(0)).toBeGreaterThan(givenFraction(4));
    expect(clueDensity(0)).toBeGreaterThan(clueDensity(4));
    expect(givenFraction(99)).toBe(CONFIG.PUZZLE_GIVEN_FLOOR);
    expect(clueDensity(99)).toBe(CONFIG.PUZZLE_CLUE_FLOOR);
  });
});

describe('isSolved', () => {
  it('accepts a complete latin square with no clues', () => {
    expect(isSolved(board({ cells: LATIN }))).toBe(true);
  });

  it('rejects an incomplete board', () => {
    const cells = [...LATIN];
    cells[5] = 0;
    expect(isSolved(board({ cells }))).toBe(false);
  });

  it('rejects a repeat in a row', () => {
    const cells = [...LATIN];
    cells[1] = 1;
    expect(isSolved(board({ cells }))).toBe(false);
  });

  it('rejects a violated horizontal clue even when the square is legal', () => {
    const across = new Array(12).fill(0);
    across[0] = GREATER_THAN; // asserts cells[0] > cells[1], i.e. 1 > 2
    expect(isSolved(board({ cells: LATIN, across }))).toBe(false);
    across[0] = LESS_THAN;
    expect(isSolved(board({ cells: LATIN, across }))).toBe(true);
  });

  it('honours vertical clues too', () => {
    const down = new Array(12).fill(0);
    down[0] = GREATER_THAN; // cells[0]=1 above cells[4]=2
    expect(isSolved(board({ cells: LATIN, down }))).toBe(false);
    down[0] = LESS_THAN;
    expect(isSolved(board({ cells: LATIN, down }))).toBe(true);
  });

  it('accepts ANY valid completion, not only the generated one', () => {
    const other = [2, 1, 4, 3, 1, 2, 3, 4, 4, 3, 2, 1, 3, 4, 1, 2];
    expect(other).not.toEqual(LATIN);
    expect(isSolved(board({ cells: other }))).toBe(true);
  });
});

describe('conflictCells', () => {
  it('flags duplicates but never empty cells', () => {
    const p = board({ cells: [1, 1, ...new Array(14).fill(0)] });
    expect(conflictCells(p).sort((a, b) => a - b)).toEqual([0, 1]);
    expect(conflictCells(board())).toEqual([]); // all-empty is neutral, not wrong
  });

  it('flags a broken clue on both sides of the pair', () => {
    const across = new Array(12).fill(0);
    across[0] = GREATER_THAN;
    const p = board({ cells: [1, 2, ...new Array(14).fill(0)], across });
    expect(conflictCells(p).sort((a, b) => a - b)).toEqual([0, 1]);
  });
});

describe('tapCell', () => {
  it('cycles a feeder 0 → 1 → … → size → 0 and counts moves', () => {
    const s = createInitialState(0, mulberry32(3));
    s.puzzle = newPuzzle(0, mulberry32(3));
    const idx = s.puzzle.givens.findIndex((g) => !g);
    for (let v = 1; v <= s.puzzle.size; v++) {
      tapCell(s, idx);
      expect(s.puzzle.cells[idx]).toBe(v);
    }
    tapCell(s, idx); // wraps back to unset
    expect(s.puzzle.cells[idx]).toBe(0);
    expect(s.puzzle.moves).toBe(s.puzzle.size + 1);
  });

  it('refuses to edit a given', () => {
    const s = createInitialState(0, mulberry32(5));
    s.puzzle = newPuzzle(0, mulberry32(5));
    const idx = s.puzzle.givens.findIndex((g) => g);
    const before = s.puzzle.cells[idx];
    expect(tapCell(s, idx)).toBeNull();
    expect(s.puzzle.cells[idx]).toBe(before);
    expect(s.puzzle.moves).toBe(0);
  });

  /** Fill every blank with a solved assignment, one tap at a time. */
  function solveBoard(s: GameState): void {
    const answer = solve(s.puzzle);
    expect(answer).not.toBeNull();
    for (let i = 0; i < s.puzzle.cells.length; i++) {
      if (s.puzzle.givens[i]) continue;
      while (s.puzzle.cells[i] !== answer![i]) tapCell(s, i);
    }
  }

  it('completing the board pays credits, lights the surge, and latches', () => {
    const s = createInitialState(0, mulberry32(7));
    s.puzzle = newPuzzle(0, mulberry32(7));
    solveBoard(s);
    expect(s.puzzle.solved).toBe(true);
    expect(isSolved(s.puzzle)).toBe(true);
    expect(s.credits).toBeGreaterThan(0);
    expect(s.boosts.surgeLeft).toBe(CONFIG.SURGE_MANUAL_SECONDS);
    expect(s.stats.puzzlesSolved).toBe(1);
    const before = [...s.puzzle.cells];
    expect(tapCell(s, s.puzzle.givens.findIndex((g) => !g))).toBeNull();
    expect(s.puzzle.cells).toEqual(before);
  });

  it('par is honest: an optimal filling stays inside the bonus window', () => {
    for (const seed of [11, 23, 41]) {
      const s = createInitialState(0, mulberry32(seed));
      s.puzzle = newPuzzle(0, mulberry32(seed));
      solveBoard(s);
      // Every blank costs exactly `value` taps from empty, which is how par is
      // defined — so filling straight to an answer can never overshoot it.
      expect(s.puzzle.moves).toBeLessThanOrEqual(s.puzzle.par);
    }
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
    s.credits = 0; // zero the ledger: this asserts what solvers PAY
    s.solvers = 2;
    runSolvers(s, CONFIG.SOLVER_SECONDS);
    const per = Math.round(CONFIG.PUZZLE_BASE_REWARD * CONFIG.SOLVER_REWARD_FACTOR);
    expect(s.credits).toBe(2 * per);
    expect(s.boosts.surgeLeft).toBe(2 * CONFIG.SURGE_AUTO_SECONDS);
    expect(s.stats.puzzlesSolved).toBe(2);
  });

  it('banks fractional progress between ticks', () => {
    const s = createInitialState(0, mulberry32(1));
    s.credits = 0;
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
