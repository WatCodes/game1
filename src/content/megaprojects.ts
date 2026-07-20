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

const PROJECTS: [string, string, string[]][] = [
  ['national-smart-grid', 'National Smart Grid',
    ['Corridor survey', 'Substation network', 'HVDC backbone', 'Demand-shaping AI', 'National synchronization']],
  ['continental-interconnect', 'Continental Interconnect',
    ['Subsea cables', 'Border interties', 'Storage buffers', 'Frequency union', 'Continental dispatch']],
  ['planetary-fusion-grid', 'Planetary Fusion Grid',
    ['Pilot tokamaks', 'Fuel cycle', 'Orbital relays', 'Planetary ring main', 'Global ignition']],
  ['dyson-swarm', 'Dyson Swarm',
    ['Foundry seeding', 'First ring', 'Ring cascade', 'Swarm choreography', 'Full swarm']],
  ['dyson-sphere', 'Dyson Sphere',
    ['Scaffold lattice', 'Hemisphere one', 'Hemisphere two', 'Radiator shells', 'Sphere closure']],
  ['stellar-engine', 'Stellar Engine (Shkadov)',
    ['Statite mirror', 'Thrust vectoring', 'Stellar rudder', 'Course lock', 'Full burn']],
  ['galactic-power-web', 'Galactic Power Web',
    ['Core taps', 'Spiral-arm trunks', 'Halo relays', 'Black-hole anchors', 'Web energization']],
  ['vacuum-kernel', 'Vacuum Kernel',
    ['Kernel seed', 'Casimir cage', 'Zero-point bloom', 'Reality anchor', 'Kernel ignition']],
];

export function buildMegaproject(tier: number): Megaproject {
  const authored = PROJECTS[tier];
  const [id, name, labels] = authored ?? [
    `exotic-lattice-${tier}`,
    `Exotic Lattice ${tier - 7}`,
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
