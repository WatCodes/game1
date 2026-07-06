import type { PowerSource } from '../engine/types';
import { CONFIG } from './config';
import { unitCost, unitOutput } from './tiers';

// Within a tier: each step up costs ~×15 and produces ~×5, so payback stretches
// as you climb the list (GAME_DESIGN §4).
const COST_MULTS = [1, 15, 225, 3400];
const OUTPUT_MULTS = [1, 5, 25, 125];

// First two sources of a tier are tier-gated; the rest hide behind research
// (ids `unlock-<sourceId>` in content/research.ts).
const SOURCE_NAMES: [string, string][][] = [
  [['battery-bank', 'Battery Bank'], ['diesel-genset', 'Diesel Genset'], ['coal-plant', 'Coal Plant'], ['gas-turbine', 'Gas Turbine']],
  [['solar-farm', 'Solar Farm'], ['wind-farm', 'Wind Farm'], ['hydro-dam', 'Hydro Dam'], ['geothermal-plant', 'Geothermal Plant']],
  [['fission-reactor', 'Fission Reactor'], ['breeder-reactor', 'Breeder Reactor'], ['fusion-tokamak', 'Fusion Tokamak']],
  [['orbital-solar-array', 'Orbital Solar Array'], ['space-elevator-tap', 'Space Elevator Tap'], ['antimatter-plant', 'Antimatter Plant']],
  [['star-lifter', 'Star-Lifter'], ['solar-statite-swarm', 'Solar Statite Swarm'], ['dyson-node', 'Dyson Node']],
  [['penrose-ring', 'Penrose Black-Hole Ring'], ['hawking-tap', 'Hawking Tap'], ['matrioshka-node', 'Matrioshka Node']],
  [['neutron-star-tap', 'Neutron-Star Tap'], ['quasar-collector', 'Quasar Collector'], ['galactic-relay', 'Galactic Relay']],
  [['zero-point-extractor', 'Zero-Point Extractor'], ['wormhole-siphon', 'Wormhole Siphon'], ['vacuum-turbine', 'Vacuum Turbine']],
];

export function sourceNamesForTier(tier: number): [string, string][] {
  const authored = SOURCE_NAMES[tier];
  if (authored) return authored;
  // Procedural tail: "Exotic Source Δ-n"
  return ['Α', 'Δ', 'Ω'].map((g, i) => [`exotic-source-${tier}-${i}`, `Exotic Source ${g}-${tier - 7}`]);
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
