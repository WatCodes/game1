import type { Megaproject } from '../engine/types';
import { megaCost } from './tiers';

const STAGE_REWARD = 1.1; // each lit stage: permanent ×1.1 this run
const COMPLETION_REWARD = 1.5;

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
    stages: labels.map((label) => ({ label, reward: STAGE_REWARD })),
    completionReward: COMPLETION_REWARD,
    committed: 0,
  };
}
