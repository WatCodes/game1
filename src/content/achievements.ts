import type { GameState } from '../engine/types';

// Records: each earned achievement grants a small permanent global multiplier
// (CONFIG.ACHIEVEMENT_BONUS). Conditions read state only — never mutate.
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  check: (s: GameState) => boolean;
}

const maxOwned = (s: GameState) => Math.max(0, ...Object.values(s.sources).map((src) => src.owned));

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-spark', name: 'First Spark', desc: 'Own your first power source.', check: (s) => maxOwned(s) >= 1 },
  { id: 'first-rack', name: 'Full Rack', desc: 'Own 25 of one source.', check: (s) => maxOwned(s) >= 25 },
  { id: 'centurion', name: 'Centurion', desc: 'Own 100 of one source.', check: (s) => maxOwned(s) >= 100 },
  { id: 'grid-titan', name: 'Grid Titan', desc: 'Own 500 of one source.', check: (s) => maxOwned(s) >= 500 },
  { id: 'megawatt-club', name: 'Megawatt Club', desc: 'Generate 1 MW·s lifetime.', check: (s) => s.stats.lifetimePower >= 1e6 },
  { id: 'terawatt-club', name: 'Terawatt Club', desc: 'Generate 1 TW·s lifetime.', check: (s) => s.stats.lifetimePower >= 1e12 },
  { id: 'yottawatt-club', name: 'Yottawatt Club', desc: 'Generate 1 YW·s lifetime.', check: (s) => s.stats.lifetimePower >= 1e24 },
  {
    id: 'scholar', name: 'Scholar', desc: 'Complete 10 research projects.',
    check: (s) => Object.values(s.research).filter((n) => n.purchased).length >= 10,
  },
  {
    id: 'polymath', name: 'Polymath', desc: 'Complete 25 research projects.',
    check: (s) => Object.values(s.research).filter((n) => n.purchased).length >= 25,
  },
  { id: 'first-light', name: 'First Light', desc: 'Ascend for the first time.', check: (s) => s.stats.ascensions >= 1 },
  { id: 'type-one', name: 'Type I', desc: 'Reach the Atomic Age.', check: (s) => s.tier >= 2 },
  { id: 'star-cager', name: 'Star Cager', desc: 'Reach the Stellar Age.', check: (s) => s.tier >= 4 },
  { id: 'type-three', name: 'Type III', desc: 'Reach the Galactic Age.', check: (s) => s.tier >= 6 },
  { id: 'switchyard-cadet', name: 'Switchyard Cadet', desc: 'Solve 10 circuits.', check: (s) => s.stats.puzzlesSolved >= 10 },
  { id: 'master-electrician', name: 'Master Electrician', desc: 'Solve 100 circuits.', check: (s) => s.stats.puzzlesSolved >= 100 },
  { id: 'always-on', name: 'Always On', desc: 'Hold a 7-day connection streak.', check: (s) => s.daily.streak >= 7 },
  { id: 'self-playing', name: 'Self-Playing', desc: 'Run 6 Auto-Solvers at once.', check: (s) => s.solvers >= 6 },
];
