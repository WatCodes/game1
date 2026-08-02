import { CONFIG } from '../content/config';
import type { GameState, Num, PuzzleState } from './types';

// Feeder Balance — a Futoshiki-style constraint board.
//
// Every row and column must carry each load level 1..N exactly once, and every
// marked pair of neighbours must respect its `<` / `>`. Tapping a cell cycles
// its load 0 → 1 → … → N → 0.
//
// Chosen over a plain Latin square because the inequalities are what make it
// *not* sudoku: the deduction is relational ("this feeder outdraws that one")
// rather than positional, which also matches the grid fiction better than
// digits-in-boxes ever could.
//
// A board is won by ANY assignment that satisfies every rule, not by matching
// the one the generator happened to draw. That is a deliberate kindness — the
// player is never told they solved the wrong valid board — and it means
// generation does not have to prove uniqueness, which at 7×7 would be far too
// slow to do on a phone between taps.

export const NO_CLUE = 0;
export const LESS_THAN = 1; // lower-indexed cell < its partner
export const GREATER_THAN = 2;

export function puzzleSize(tier: number): number {
  return Math.min(4 + Math.floor(tier / 2), 7);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Share of cells pre-filled. Shrinks with tier, with a floor. */
export function givenFraction(tier: number): number {
  return clamp(
    CONFIG.PUZZLE_GIVEN_FRACTION - CONFIG.PUZZLE_GIVEN_DECAY * tier,
    CONFIG.PUZZLE_GIVEN_FLOOR,
    1,
  );
}

/** Share of adjacent pairs carrying an inequality. Shrinks with tier. */
export function clueDensity(tier: number): number {
  return clamp(CONFIG.PUZZLE_CLUE_DENSITY - CONFIG.PUZZLE_CLUE_DECAY * tier, CONFIG.PUZZLE_CLUE_FLOOR, 1);
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * A uniformly-ish random Latin square, built by permuting a cyclic base.
 *
 * Not a perfectly uniform draw over all Latin squares — that needs Jacobson-
 * Matthews and is pointless here — but shuffling rows, columns and symbol
 * labels independently removes every visible trace of the cyclic seed, which
 * is the only property a player can perceive. Crucially it cannot fail, so
 * dealing a board is O(N²) with no backtracking and no retry loop.
 */
function latinSquare(size: number, rand: () => number): number[] {
  const rows = shuffle(
    Array.from({ length: size }, (_, i) => i),
    rand,
  );
  const cols = shuffle(
    Array.from({ length: size }, (_, i) => i),
    rand,
  );
  const symbols = shuffle(
    Array.from({ length: size }, (_, i) => i + 1),
    rand,
  );

  const out = new Array<number>(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      out[r * size + c] = symbols[(rows[r] + cols[c]) % size];
    }
  }
  return out;
}

/** Deal a fresh board for `tier`. */
export function newPuzzle(tier: number, rand: () => number = Math.random): PuzzleState {
  const size = puzzleSize(tier);
  const n = size * size;
  const solution = latinSquare(size, rand);

  // Inequalities are read off the solution, so the board is always satisfiable.
  const density = clueDensity(tier);
  const across = new Array<number>(size * (size - 1)).fill(NO_CLUE);
  const down = new Array<number>((size - 1) * size).fill(NO_CLUE);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size - 1; c++) {
      if (rand() >= density) continue;
      const a = solution[r * size + c];
      const b = solution[r * size + c + 1];
      across[r * (size - 1) + c] = a < b ? LESS_THAN : GREATER_THAN;
    }
  }
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size; c++) {
      if (rand() >= density) continue;
      const a = solution[r * size + c];
      const b = solution[(r + 1) * size + c];
      down[r * size + c] = a < b ? LESS_THAN : GREATER_THAN;
    }
  }

  // Reveal a random subset as givens; the rest start blank.
  const order = shuffle(
    Array.from({ length: n }, (_, i) => i),
    rand,
  );
  let reveal = Math.round(n * givenFraction(tier));
  // Always leave real work to do, and never hand over a board that is already
  // finished — both would pay out for a single tap.
  reveal = clamp(reveal, 0, n - Math.max(2, size));

  const givens = new Array<boolean>(n).fill(false);
  const cells = new Array<number>(n).fill(0);
  for (let k = 0; k < reveal; k++) {
    const idx = order[k];
    givens[idx] = true;
    cells[idx] = solution[idx];
  }

  // Cycling 0 → 1 → … → N means reaching value v costs exactly v taps, so the
  // cheapest possible completion is the sum of the blanks' target values. It is
  // a true lower bound rather than an estimate, which is what makes the
  // efficiency bonus fair on a board with several valid solutions.
  let par = 0;
  for (let i = 0; i < n; i++) if (!givens[i]) par += solution[i];

  return { tier, size, cells, givens, across, down, moves: 0, par: Math.max(1, par), solved: false };
}

function isPermutation(values: number[], size: number): boolean {
  const seen = new Array<boolean>(size + 1).fill(false);
  for (const v of values) {
    if (v < 1 || v > size || seen[v]) return false;
    seen[v] = true;
  }
  return true;
}

/** True if a filled pair respects its clue. Unset cells never violate one. */
function clueHolds(clue: number, a: number, b: number): boolean {
  if (clue === NO_CLUE || a === 0 || b === 0) return true;
  return clue === LESS_THAN ? a < b : a > b;
}

/**
 * Any complete assignment satisfying every row, column and clue wins — the
 * board is not compared against the generator's solution.
 */
export function isSolved(p: PuzzleState): boolean {
  const { size, cells } = p;
  if (cells.some((v) => v < 1 || v > size)) return false;

  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    const col: number[] = [];
    for (let i = 0; i < size; i++) {
      row.push(cells[r * size + i]);
      col.push(cells[i * size + r]);
    }
    if (!isPermutation(row, size) || !isPermutation(col, size)) return false;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size - 1; c++) {
      if (!clueHolds(p.across[r * (size - 1) + c], cells[r * size + c], cells[r * size + c + 1])) return false;
    }
  }
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size; c++) {
      if (!clueHolds(p.down[r * size + c], cells[r * size + c], cells[(r + 1) * size + c])) return false;
    }
  }
  return true;
}

/**
 * Indices currently breaking a rule, so the UI can mark them without telling
 * the player the answer. Only *filled* cells are ever flagged — an empty board
 * should look neutral, not wrong.
 */
export function conflictCells(p: PuzzleState): number[] {
  const { size, cells } = p;
  const bad = new Set<number>();

  for (let r = 0; r < size; r++) {
    for (let a = 0; a < size; a++) {
      for (let b = a + 1; b < size; b++) {
        const ri = r * size + a;
        const rj = r * size + b;
        if (cells[ri] !== 0 && cells[ri] === cells[rj]) bad.add(ri).add(rj);
        const ci = a * size + r;
        const cj = b * size + r;
        if (cells[ci] !== 0 && cells[ci] === cells[cj]) bad.add(ci).add(cj);
      }
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size - 1; c++) {
      const i = r * size + c;
      const j = i + 1;
      if (!clueHolds(p.across[r * (size - 1) + c], cells[i], cells[j])) bad.add(i).add(j);
    }
  }
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      const j = i + size;
      if (!clueHolds(p.down[r * size + c], cells[i], cells[j])) bad.add(i).add(j);
    }
  }
  return [...bad];
}

/** Credits for a manual solve; near-par solves earn the efficiency bonus. */
export function puzzleReward(tier: number, moves: number, par: number): Num {
  const base = CONFIG.PUZZLE_BASE_REWARD + CONFIG.PUZZLE_TIER_REWARD * tier;
  return moves <= par + CONFIG.PUZZLE_BONUS_SLACK ? Math.round(base * CONFIG.PUZZLE_BONUS_MULT) : base;
}

export interface SolveResult {
  reward: Num;
  bonus: boolean;
}

/**
 * Cycle one feeder's load. Givens are fixed and ignore taps. If the board is
 * complete and legal: pay Credits, extend the Grid Surge, and latch `solved`
 * until the player deals a new one.
 */
export function tapCell(s: GameState, idx: number): SolveResult | null {
  const p = s.puzzle;
  if (idx < 0 || idx >= p.cells.length || p.solved || p.givens[idx]) return null;
  p.cells[idx] = (p.cells[idx] + 1) % (p.size + 1);
  p.moves += 1;
  if (!isSolved(p)) return null;
  p.solved = true;
  const bonus = p.moves <= p.par + CONFIG.PUZZLE_BONUS_SLACK;
  const reward = puzzleReward(p.tier, p.moves, p.par);
  s.credits += reward;
  s.boosts.surgeLeft = Math.min(CONFIG.SURGE_CAP_SECONDS, s.boosts.surgeLeft + CONFIG.SURGE_MANUAL_SECONDS);
  s.stats.puzzlesSolved += 1;
  return { reward, bonus };
}

/**
 * Auto-solvers grind boards in the background: reduced Credits and a shorter
 * surge per solve. Enough of them keep the surge lit permanently — the layer
 * "plays itself".
 */
export function runSolvers(s: GameState, dt: number): void {
  if (s.solvers <= 0) return;
  s.solverProgress += (s.solvers * dt) / CONFIG.SOLVER_SECONDS;
  const n = Math.floor(s.solverProgress);
  if (n <= 0) return;
  s.solverProgress -= n;
  const base = CONFIG.PUZZLE_BASE_REWARD + CONFIG.PUZZLE_TIER_REWARD * s.tier;
  s.credits += n * Math.round(base * CONFIG.SOLVER_REWARD_FACTOR);
  s.boosts.surgeLeft = Math.min(CONFIG.SURGE_CAP_SECONDS, s.boosts.surgeLeft + n * CONFIG.SURGE_AUTO_SECONDS);
  s.stats.puzzlesSolved += n;
}
