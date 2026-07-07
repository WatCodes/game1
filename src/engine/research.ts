import { CONFIG } from '../content/config';
import type { GameState, Id, ResearchNode } from './types';
import { accretionOutputMult, accretionUpkeepMult, relayPowerMult, relayRpMult } from './tierTwists';

/**
 * Aggregated effects of all purchased research — recomputed on read, never
 * stored. Also folds in the run-scoped tier twists (accretion feed rate, T6
 * relay routing): this is the single multiplier bag already threaded through
 * every consumer (economy, megaproject, offline, loop), so tier twists ride
 * along for free instead of rippling a new parameter through a dozen call
 * sites. Each twist is a no-op outside its own tier.
 */
export interface ResearchModifiers {
  sourceMult: Record<Id, number>;
  globalMult: number;
  rpMult: number;
  megaCostMult: number; // 0..1, applied to megaproject totalCost
  upkeepMult: number; // 0..1, applied to all source upkeep
  offlineBonusSeconds: number;
  unlockedSources: Set<Id>;
  automatedSources: Set<Id>;
}

export function researchModifiers(s: GameState): ResearchModifiers {
  const mods: ResearchModifiers = {
    sourceMult: {},
    globalMult: 1,
    rpMult: 1,
    megaCostMult: 1,
    upkeepMult: 1,
    offlineBonusSeconds: 0,
    unlockedSources: new Set(),
    automatedSources: new Set(),
  };
  for (const node of Object.values(s.research)) {
    if (!node.purchased) continue;
    const e = node.effect;
    switch (e.kind) {
      case 'unlockSource':
        mods.unlockedSources.add(e.sourceId);
        break;
      case 'multSource':
        mods.sourceMult[e.sourceId] = (mods.sourceMult[e.sourceId] ?? 1) * e.x;
        break;
      case 'multGlobal':
        mods.globalMult *= e.x;
        break;
      case 'multRpRate':
        mods.rpMult *= e.x;
        break;
      case 'reduceMegaprojectCost':
        mods.megaCostMult *= 1 - e.x;
        break;
      case 'reduceUpkeep':
        mods.upkeepMult *= 1 - e.x;
        break;
      case 'increaseOfflineCap':
        mods.offlineBonusSeconds += e.seconds;
        break;
      case 'unlockAutomation':
        mods.automatedSources.add(e.sourceId);
        break;
    }
  }
  mods.globalMult *= accretionOutputMult(s) * relayPowerMult(s);
  mods.upkeepMult *= accretionUpkeepMult(s);
  mods.rpMult *= relayRpMult(s);
  return mods;
}

export function researchRate(s: GameState): number {
  const boost = s.boosts.rpLeft > 0 ? CONFIG.BOOST_MULT : 1;
  return (CONFIG.BASE_RESEARCH_RATE * researchModifiers(s).rpMult + s.kp * CONFIG.KP_RP_BONUS) * boost;
}

export function prereqsMet(s: GameState, node: ResearchNode): boolean {
  return node.prereqs.every((id) => s.research[id]?.purchased);
}

export function isResearchAvailable(s: GameState, node: ResearchNode): boolean {
  return !node.purchased && node.tier <= s.tier && prereqsMet(s, node);
}

export function canBuyResearch(s: GameState, id: Id): boolean {
  const node = s.research[id];
  return !!node && isResearchAvailable(s, node) && s.rp >= node.cost;
}

export function buyResearch(s: GameState, id: Id): boolean {
  if (!canBuyResearch(s, id)) return false;
  const node = s.research[id];
  s.rp -= node.cost;
  node.purchased = true;
  applyEffect(s, node);
  return true;
}

/**
 * Most effects are computed on read via researchModifiers; only automation flips
 * runtime state. Re-run for every purchased node after sources are rebuilt
 * (load, ascend) so managers survive.
 */
export function applyEffect(s: GameState, node: ResearchNode): void {
  const e = node.effect;
  if (e.kind === 'unlockAutomation') {
    const src = s.sources[e.sourceId];
    if (src) src.automated = true;
  }
}

export function reapplyPurchasedEffects(s: GameState): void {
  for (const node of Object.values(s.research)) {
    if (node.purchased) applyEffect(s, node);
  }
}
