import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import {
  authorizeStage,
  authorizedBoundary,
  canAuthorizeStage,
  commitPower,
  isMegaprojectComplete,
  nextStageResearchBlock,
  routeIncome,
  stageRpCost,
} from '../src/engine/megaproject';
import { cheapestNextCost, maxSafeCommit } from '../src/engine/economy';
import { buyResearch, researchModifiers } from '../src/engine/research';

function state() {
  return createInitialState(0);
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
    // lump commits clamp too
    s.power = 1e12;
    expect(commitPower(s, 1e12)).toBe(0);
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

  it('completion requires all stages authorized and filled', () => {
    const s = state();
    s.rp = 1e12;
    s.power = 1e12;
    buyResearch(s, 'rp-t0');
    buyResearch(s, 'boost-battery-bank');
    buyResearch(s, 'global-t0');
    buyResearch(s, 'mega-t0');
    for (let i = 0; i < 4; i++) authorizeStage(s);
    commitPower(s, 1e12);
    // mega-t0 reduces cost 15%, so completion compares against effective cost
    expect(isMegaprojectComplete(s)).toBe(true);
  });
});

describe('anti-softlock commit guard', () => {
  it('with no income, always keeps enough for the cheapest source', () => {
    const s = state(); // owns nothing → pps 0
    s.power = 100;
    const reserve = cheapestNextCost(s);
    expect(reserve).toBe(10); // battery bank
    expect(maxSafeCommit(s)).toBeCloseTo(90);
  });

  it('cannot commit at all when power barely covers the cheapest source', () => {
    const s = state();
    s.power = 10;
    expect(maxSafeCommit(s)).toBe(0);
  });

  it('with income flowing, the full remainder is committable', () => {
    const s = state();
    s.sources['battery-bank'].owned = 5; // pps > 0
    s.power = 100;
    expect(maxSafeCommit(s)).toBeCloseTo(100);
  });
});
