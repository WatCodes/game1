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
  return 1.5e5 * Math.pow(MEGA_STEP, tier);
}

export function kpDivisor(tier: number): number {
  return 7e4 * Math.pow(KP_DIV_STEP, tier);
}

const TIERS: Omit<KardashevTier, 'baseCostMult' | 'kpDivisor'>[] = [
  { index: 0, era: 'Fossil Age', scaleCopy: 'a household, then a city' },
  { index: 1, era: 'Renewable Age', scaleCopy: 'an entire region' },
  { index: 2, era: 'Atomic Age', scaleCopy: 'a nation, then a planet', kardashevLabel: 'Type I' },
  { index: 3, era: 'Orbital Age', scaleCopy: 'near-Earth space' },
  { index: 4, era: 'Stellar Age', scaleCopy: 'an entire star', kardashevLabel: 'Type II' },
  { index: 5, era: 'Exotic Age', scaleCopy: 'black holes and stellar engines' },
  { index: 6, era: 'Galactic Age', scaleCopy: 'the entire galaxy', kardashevLabel: 'Type III' },
  { index: 7, era: 'Transcendent Age', scaleCopy: 'spacetime itself', kardashevLabel: 'Type IV' },
];

/** Tiers 0–7 are authored; 8+ is the procedural prestige tail. */
export function getTier(index: number): KardashevTier {
  const base = TIERS[index];
  if (base) return { ...base, baseCostMult: Math.pow(COST_STEP, index), kpDivisor: kpDivisor(index) };
  return {
    index,
    era: `Kardashev IV.${index - 7}`,
    scaleCopy: 'realities beyond counting',
    kardashevLabel: `Type IV.${index - 7}`,
    baseCostMult: Math.pow(COST_STEP, index),
    kpDivisor: kpDivisor(index),
  };
}
