import type { Id, Megaproject } from '../engine/types';
import { megaCost } from './tiers';
import { RP_BASE } from './research';

const STAGE_REWARD = 1.1; // each lit stage: permanent ×1.1 this run
const COMPLETION_REWARD = 1.5;

// Total RP to authorize stages 2..5 (stage 1 is free). ~20× the tier's base
// research cost, so finishing a project demands real engagement with the tree.
export function megaRpCost(tier: number): number {
  const base = RP_BASE[tier];
  if (base !== undefined) return 20 * base;
  return 20 * RP_BASE[RP_BASE.length - 1] * Math.pow(5, tier - (RP_BASE.length - 1));
}

// Later stages are locked until the tier's key techs are researched — power
// alone can't finish the build (stages 3/4/5 need rp/global/mega nodes).
function stageResearchFor(tier: number, authored: boolean): (Id | null)[] {
  if (!authored) return [null, null, null, null, null];
  return [null, null, `rp-t${tier}`, `global-t${tier}`, `mega-t${tier}`];
}

// Names/labels are themed; ids stay stable so saved progress keeps its project.
const PROJECTS: [string, string, string[]][] = [
  ['national-smart-grid', 'The Temple of Zeus',
    ['Clear the rubble', 'Raise the columns', 'String the copper', 'Seat the thunderstone', 'First lightning']],
  ['continental-interconnect', 'The Nine Roads',
    ['Survey the passes', 'Bridge the straits', 'Waystation nests', 'Signal towers', 'The roads meet']],
  ['planetary-fusion-grid', 'The World Hearth',
    ['Break ground', 'Ring the hearth', 'Feed the fire', 'Bank the coals', 'The world warms']],
  ['dyson-swarm', 'The Sunbeam Swarm',
    ['Seed the foundry', 'First ring', 'Ring cascade', 'Swarm choreography', 'The sky fills']],
  ['dyson-sphere', 'The Great Sunbed',
    ['Lay the lattice', 'First hemisphere', 'Second hemisphere', 'Radiator fur', 'The sun is ours']],
  ['stellar-engine', 'The Shkadov Prowl',
    ['Statite mirror', 'Thrust vectoring', 'Stellar rudder', 'Course lock', 'The star moves']],
  ['galactic-power-web', 'The Galactic Cradle',
    ['Core taps', 'Spiral-arm trunks', 'Halo relays', 'Black-hole anchors', 'The cradle wakes']],
  ['vacuum-kernel', 'The Ninth Life',
    ['Kernel seed', 'Casimir cage', 'Zero-point bloom', 'Reality anchor', 'The ninth life begins']],
];

export function buildMegaproject(tier: number): Megaproject {
  const authored = PROJECTS[tier];
  const [id, name, labels] = authored ?? [
    `exotic-lattice-${tier}`,
    `Aether Lattice ${tier - 7}`,
    ['Phase I', 'Phase II', 'Phase III', 'Phase IV', 'Phase V'],
  ];
  return {
    id,
    name,
    tier,
    totalCost: megaCost(tier),
    rpCost: megaRpCost(tier),
    stages: labels.map((label) => ({ label, reward: STAGE_REWARD })),
    stageResearch: stageResearchFor(tier, authored !== undefined),
    completionReward: COMPLETION_REWARD,
    committed: 0,
    stagesAuthorized: 1,
    decommissionedStages: 0,
  };
}
