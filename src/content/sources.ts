import type { PowerSource } from '../engine/types';
import { CONFIG } from './config';
import { unitCost, unitOutput } from './tiers';

// Within a tier: each step up costs ~×15 and produces ~×5, so payback stretches
// as you climb the list (GAME_DESIGN §4).
const COST_MULTS = [1, 15, 225, 3400];
const OUTPUT_MULTS = [1, 5, 25, 125];

// First two sources of a tier are tier-gated; the rest hide behind research
// (ids `unlock-<sourceId>` in content/research.ts).
// IDs are load-bearing — saves key `owned` by them and research effects
// reference them (`unlock-coal-plant`, `boost-battery-bank`). Only the display
// names are themed, so a reskin can never invalidate a save.
const SOURCE_NAMES: [string, string][][] = [
  [['battery-bank', 'Biscuit Kneader'], ['diesel-genset', 'Yarn Dynamo'], ['coal-plant', 'Scratching Post Turbine'], ['gas-turbine', 'Zoomie Track']],
  [['solar-farm', 'Sunbeam Nappery'], ['wind-farm', 'Whisker Windmill'], ['hydro-dam', 'Fountain Dam'], ['geothermal-plant', 'Hearthstone Well']],
  [['fission-reactor', 'Purr Reactor'], ['breeder-reactor', 'Nine Lives Breeder'], ['fusion-tokamak', 'Pride Fusion Core']],
  [['orbital-solar-array', 'Orbital Sunbeam Array'], ['space-elevator-tap', 'Skyclaw Elevator'], ['antimatter-plant', 'Antimatter Cattery']],
  [['star-lifter', 'Sun-Lifter'], ['solar-statite-swarm', 'Statite Prowl'], ['dyson-node', 'Dyson Cradle']],
  [['penrose-ring', 'Penrose Prowl Ring'], ['hawking-tap', 'Hawking Whisker'], ['matrioshka-node', 'Matrioshka Nest']],
  [['neutron-star-tap', 'Neutron Claw'], ['quasar-collector', 'Quasar Collector'], ['galactic-relay', 'Galactic Relay']],
  [['zero-point-extractor', 'Zero-Point Whisker'], ['wormhole-siphon', 'Wormhole Siphon'], ['vacuum-turbine', 'Aether Turbine']],
];

export function sourceNamesForTier(tier: number): [string, string][] {
  const authored = SOURCE_NAMES[tier];
  if (authored) return authored;
  // Procedural tail: "Aether Engine Δ-n"
  return ['Α', 'Δ', 'Ω'].map((g, i) => [`exotic-source-${tier}-${i}`, `Aether Engine ${g}-${tier - 7}`]);
}

export function buildSources(tier: number): PowerSource[] {
  const names = sourceNamesForTier(tier);
  return names.map(([id, name], i) => ({
    id,
    name,
    tier,
    baseCost: unitCost(tier) * COST_MULTS[i],
    costGrowth: CONFIG.COST_GROWTH,
    baseOutput: unitOutput(tier) * OUTPUT_MULTS[i],
    baseUpkeep: unitOutput(tier) * OUTPUT_MULTS[i] * CONFIG.UPKEEP_FACTOR,
    owned: 0,
    unlockedBy: i < 2 || tier >= SOURCE_NAMES.length ? { tier } : `unlock-${id}`,
    automated: false,
  }));
}
