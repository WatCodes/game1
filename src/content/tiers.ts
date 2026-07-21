import type { KardashevTier } from '../engine/types';

// Inter-tier scale steps: outputs (×900 × era ×4 = ×3600 effective) slightly
// outpace costs (×2500), so each re-climb trends faster even before KP.
export const COST_STEP = 2500;
export const OUTPUT_STEP = 900;
export const MEGA_STEP = 3500;
export const KP_DIV_STEP = 3500;

export function unitCost(tier: number): number {
  return 10 * Math.pow(COST_STEP, tier);
}

export function unitOutput(tier: number): number {
  return 0.5 * Math.pow(OUTPUT_STEP, tier);
}

export function megaCost(tier: number): number {
  return 3.5e5 * Math.pow(MEGA_STEP, tier);
}

export function kpDivisor(tier: number): number {
  return 1.2e5 * Math.pow(KP_DIV_STEP, tier);
}

// The cats' climb: Athens → the continents → the world → orbit → the sun →
// the dark → the galaxy → spacetime. Greek names for the eras, because the
// first spark was stolen from the Temple of Zeus.
const TIERS: Omit<KardashevTier, 'baseCostMult' | 'kpDivisor'>[] = [
  { index: 0, era: 'Age of Athens', scaleCopy: 'one shrine, then a city of cats' },
  { index: 1, era: 'Age of Colonies', scaleCopy: 'a whole continent' },
  { index: 2, era: 'Age of Dominion', scaleCopy: 'every continent, then the world', kardashevLabel: 'Type I' },
  { index: 3, era: 'Age of Ascent', scaleCopy: 'orbit and the near sky' },
  { index: 4, era: 'Age of Helios', scaleCopy: 'planet by planet, then the sun', kardashevLabel: 'Type II' },
  { index: 5, era: 'Age of Erebus', scaleCopy: 'black holes and stellar engines' },
  { index: 6, era: 'Age of Constellations', scaleCopy: 'system by system, the whole galaxy', kardashevLabel: 'Type III' },
  { index: 7, era: 'Age of Aether', scaleCopy: 'spacetime itself', kardashevLabel: 'Type IV' },
];

/** Tiers 0–7 are authored; 8+ is the procedural prestige tail. */
export function getTier(index: number): KardashevTier {
  const base = TIERS[index];
  if (base) return { ...base, baseCostMult: Math.pow(COST_STEP, index), kpDivisor: kpDivisor(index) };
  return {
    index,
    era: `Aether ${index - 7}`,
    scaleCopy: 'realities beyond counting',
    kardashevLabel: `Type IV.${index - 7}`,
    baseCostMult: Math.pow(COST_STEP, index),
    kpDivisor: kpDivisor(index),
  };
}
