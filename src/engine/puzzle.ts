import { CONFIG } from '../content/config';
import type { GameState, Num, PuzzleState, PuzzleTile, TileKind } from './types';

// Directions: 0=N 1=E 2=S 3=W. A tile's connections are its base shape's
// directions rotated by rot quarter-turns.
const BASE_CONNS: Record<TileKind, number[]> = {
  stub: [0],
  straight: [0, 2],
  corner: [0, 1],
  tee: [0, 1, 2],
  cross: [0, 1, 2, 3],
};

export function conns(tile: PuzzleTile): number[] {
  return BASE_CONNS[tile.kind].map((d) => (d + tile.rot) % 4);
}

function connKey(dirs: number[]): string {
  return [...dirs].sort().join('');
}

/** Find the tile kind + rotation whose connections equal `dirs` exactly. */
function tileFor(dirs: number[]): { kind: TileKind; rot: number } {
  const want = connKey(dirs);
  for (const kind of Object.keys(BASE_CONNS) as TileKind[]) {
    for (let rot = 0; rot < 4; rot++) {
      if (connKey(BASE_CONNS[kind].map((d) => (d + rot) % 4)) === want) return { kind, rot };
    }
  }
  throw new Error(`No tile matches connections [${dirs}]`); // unreachable for non-empty dirs
}

function neighbor(idx: number, dir: number, size: number): number | null {
  const x = idx % size;
  const y = Math.floor(idx / size);
  if (dir === 0) return y > 0 ? idx - size : null;
  if (dir === 1) return x < size - 1 ? idx + 1 : null;
  if (dir === 2) return y < size - 1 ? idx + size : null;
  return x > 0 ? idx - 1 : null;
}

export function puzzleSize(tier: number): number {
  return Math.min(4 + Math.floor(tier / 2), 7);
}

/**
 * Generate a puzzle in SOLVED orientation: a recursive-backtracker spanning
 * tree over the grid, so every tile is part of one circuit. The generator
 * picks a leaf as the source; every other leaf is a district (sink) that must
 * be powered. Scramble before showing it to the player.
 */
export function generatePuzzle(tier: number, rand: () => number = Math.random): PuzzleState {
  const size = puzzleSize(tier);
  const n = size * size;
  const adj: number[][] = Array.from({ length: n }, () => []);
  const visited = new Array<boolean>(n).fill(false);
  const stack = [Math.floor(rand() * n)];
  visited[stack[0]] = true;
  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const dirs = [0, 1, 2, 3]
      .map((d) => ({ d, sort: rand() }))
      .sort((a, b) => a.sort - b.sort)
      .map((o) => o.d);
    let advanced = false;
    for (const d of dirs) {
      const next = neighbor(cur, d, size);
      if (next !== null && !visited[next]) {
        visited[next] = true;
        adj[cur].push(d);
        adj[next].push((d + 2) % 4);
        stack.push(next);
        advanced = true;
        break;
      }
    }
    if (!advanced) stack.pop();
  }

  const leaves = adj.map((dirs, i) => ({ dirs, i })).filter((c) => c.dirs.length === 1).map((c) => c.i);
  const source = leaves[Math.floor(rand() * leaves.length)];
  const tiles: PuzzleTile[] = adj.map((dirs, i) => ({
    ...tileFor(dirs),
    role: i === source ? 'source' : leaves.includes(i) ? 'sink' : 'wire',
  }));
  return { tier, size, tiles, moves: 0, par: 0, solved: false };
}

/** Minimal forward quarter-turns to make `tile` connection-equivalent to rot `target`. */
function minTurns(tile: PuzzleTile, target: number): number {
  const want = connKey(BASE_CONNS[tile.kind].map((d) => (d + target) % 4));
  for (let k = 0; k < 4; k++) {
    if (connKey(BASE_CONNS[tile.kind].map((d) => (d + tile.rot + k) % 4)) === want) return k;
  }
  return 0;
}

/** Randomize rotations, compute par, and guarantee the result isn't pre-solved. */
export function scramblePuzzle(p: PuzzleState, rand: () => number = Math.random): PuzzleState {
  const solution = p.tiles.map((t) => t.rot);
  for (const t of p.tiles) t.rot = (t.rot + Math.floor(rand() * 4)) % 4;
  if (isSolved(p)) {
    const i = p.tiles.findIndex((t) => t.kind !== 'cross');
    if (i >= 0) p.tiles[i].rot = (p.tiles[i].rot + 1) % 4;
  }
  p.par = p.tiles.reduce((sum, t, i) => sum + minTurns(t, solution[i]), 0);
  p.moves = 0;
  p.solved = false;
  return p;
}

export function newPuzzle(tier: number, rand: () => number = Math.random): PuzzleState {
  return scramblePuzzle(generatePuzzle(tier, rand), rand);
}

/** Indices reachable from the source through matching connections. */
export function poweredSet(p: PuzzleState): Set<number> {
  const source = p.tiles.findIndex((t) => t.role === 'source');
  const powered = new Set<number>();
  if (source < 0) return powered;
  const queue = [source];
  powered.add(source);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const d of conns(p.tiles[cur])) {
      const next = neighbor(cur, d, p.size);
      if (next === null || powered.has(next)) continue;
      if (conns(p.tiles[next]).includes((d + 2) % 4)) {
        powered.add(next);
        queue.push(next);
      }
    }
  }
  return powered;
}

export function isSolved(p: PuzzleState): boolean {
  const powered = poweredSet(p);
  return p.tiles.every((t, i) => t.role !== 'sink' || powered.has(i));
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
 * Rotate one tile. If that completes the circuit: pay Credits, extend the
 * Grid Surge, and latch `solved` (further rotations are ignored until the
 * player deals a new circuit).
 */
export function rotateTile(s: GameState, idx: number): SolveResult | null {
  const p = s.puzzle;
  const tile = p.tiles[idx];
  if (!tile || p.solved) return null;
  tile.rot = (tile.rot + 1) % 4;
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
 * Auto-solvers grind puzzles in the background: reduced Credits and a shorter
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
