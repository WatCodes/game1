import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import {
  applyStageDecommission,
  authorizeStage,
  authorizedBoundary,
  canAuthorizeStage,
  isMegaprojectComplete,
  nextStageResearchBlock,
  routeIncome,
  stageRpCost,
  stagesCompleted,
} from '../src/engine/megaproject';
import { buyResearch, researchModifiers } from '../src/engine/research';
import { CONFIG } from '../src/content/config';

function state() {
  const s = createInitialState(0);
  s.stats.lifetimePower = 1e9; // past every progressive-unlock gate
  return s;
}

describe('stage authorization', () => {
  it('stage 1 is free, later stages cost rpCost/(n−1) each', () => {
    const s = state();
    expect(s.megaproject.stagesAuthorized).toBe(1);
    expect(stageRpCost(s)).toBeCloseTo(s.megaproject.rpCost / 4);
  });

  it('power cannot fill past the authorized boundary', () => {
    const s = state();
    const mods = researchModifiers(s);
    const boundary = authorizedBoundary(s, mods); // 1/5 of total
    expect(boundary).toBeCloseTo(s.megaproject.totalCost / 5);
    // routing clamps
    const routed = routeIncome(s, boundary * 10, { ...mods });
    expect(routed).toBeCloseTo(boundary * (s.routePct || 0)); // routePct 0 → nothing
    s.routePct = 1;
    expect(routeIncome(s, boundary * 10, mods)).toBeCloseTo(boundary);
    expect(s.megaproject.committed).toBeCloseTo(boundary);
    // and it stays clamped — more income cannot push past the boundary
    expect(routeIncome(s, boundary * 10, mods)).toBe(0);
  });

  it('authorization needs RP', () => {
    const s = state();
    s.rp = stageRpCost(s) - 1;
    expect(canAuthorizeStage(s)).toBe(false);
    s.rp = stageRpCost(s);
    expect(authorizeStage(s)).toBe(true);
    expect(s.rp).toBeCloseTo(0);
    expect(s.megaproject.stagesAuthorized).toBe(2);
  });

  it('stages 3–5 are locked behind the tier’s key research', () => {
    const s = state();
    s.rp = 1e12;
    authorizeStage(s); // stage 2: no research needed
    // stage 3 needs rp-t0
    expect(nextStageResearchBlock(s)).toBe('rp-t0');
    expect(canAuthorizeStage(s)).toBe(false);
    buyResearch(s, 'rp-t0');
    expect(canAuthorizeStage(s)).toBe(true);
    authorizeStage(s);
    // stage 4 needs global-t0 (which itself has a prereq)
    expect(nextStageResearchBlock(s)).toBe('global-t0');
    buyResearch(s, 'boost-battery-bank');
    buyResearch(s, 'global-t0');
    authorizeStage(s);
    // stage 5 needs mega-t0
    expect(nextStageResearchBlock(s)).toBe('mega-t0');
    buyResearch(s, 'mega-t0');
    authorizeStage(s);
    expect(s.megaproject.stagesAuthorized).toBe(5);
    expect(canAuthorizeStage(s)).toBe(false); // nothing left to authorize
  });

  it('completion requires all stages authorized, not just endless income', () => {
    const s = state();
    s.rp = 1e12;
    s.routePct = 1;
    buyResearch(s, 'rp-t0');
    buyResearch(s, 'boost-battery-bank');
    buyResearch(s, 'global-t0');
    buyResearch(s, 'mega-t0');
    const mods = researchModifiers(s);

    // Pouring in unlimited income stalls at the authorized boundary.
    routeIncome(s, 1e12, mods);
    expect(isMegaprojectComplete(s)).toBe(false);

    // Only clearing the RP/research gates lets the rest of it fill.
    for (let i = 0; i < 4; i++) authorizeStage(s);
    routeIncome(s, 1e12, mods);
    // mega-t0 reduces cost 15%, so completion compares against effective cost
    expect(isMegaprojectComplete(s)).toBe(true);
  });
});

describe('stage decommission', () => {
  it('completing a stage dismantles a fraction of the fleet, once, idempotently', () => {
    const s = state();
    s.sources['battery-bank'].owned = 100;
    const mods = researchModifiers(s);
    // fill exactly one stage (1/5 of the effective cost)
    s.megaproject.committed = s.megaproject.totalCost / s.megaproject.stages.length;
    expect(stagesCompleted(s, mods)).toBe(1);
    const removed = applyStageDecommission(s, mods);
    const expected = Math.floor(100 * CONFIG.STAGE_DECOMMISSION[0]);
    expect(removed).toBe(expected);
    expect(s.sources['battery-bank'].owned).toBe(100 - expected);
    expect(s.megaproject.decommissionedStages).toBe(1);
    // running again with no new stage completed removes nothing
    expect(applyStageDecommission(s, mods)).toBe(0);
  });

  it('salvage research dismantles proportionally fewer plants', () => {
    const s = state();
    s.sources['battery-bank'].owned = 100;
    const mods = researchModifiers(s);
    mods.decommissionMult = 0.7; // as if salvage research were purchased
    s.megaproject.committed = s.megaproject.totalCost / s.megaproject.stages.length;
    applyStageDecommission(s, mods);
    // 30% fewer than the plain 8% cut
    expect(s.sources['battery-bank'].owned).toBe(100 - Math.floor(100 * CONFIG.STAGE_DECOMMISSION[0] * 0.7));
  });

  it('drains the lowest-output source before touching a higher one', () => {
    const s = state();
    s.sources['battery-bank'].owned = 10; // lowest baseOutput
    s.sources['coal-plant'].owned = 100; // higher baseOutput
    const mods = researchModifiers(s);
    // jump straight to the final stage's (largest) cut
    s.megaproject.decommissionedStages = 4;
    s.megaproject.committed = s.megaproject.totalCost; // all stages complete
    applyStageDecommission(s, mods); // fires stage index 4 only
    const cut = Math.floor(110 * CONFIG.STAGE_DECOMMISSION[4]); // > the 10 battery units
    expect(s.sources['battery-bank'].owned).toBe(0); // drained first
    expect(s.sources['coal-plant'].owned).toBe(100 - (cut - 10)); // remainder from coal
  });
});

// The "anti-softlock commit guard" suite lived here. It covered lump-sum
// commits from the Watt bank, which no longer exist — the Project rail takes a
// fraction of income, so there is no lump that could strand a run.
