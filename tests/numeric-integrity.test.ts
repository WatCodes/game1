import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/engine/types';
import { createInitialState } from '../src/engine/state';
import { tick } from '../src/engine/loop';
import { buy } from '../src/engine/economy';
import { ascend } from '../src/engine/ascension';
import { buyGridUpgrade } from '../src/engine/grid';
import { buyDispatchRecharge, buyPowerBoost, buyRpBoost, buySolver } from '../src/engine/shop';
import { arbitrageUnlocked, chargeReserve } from '../src/engine/arbitrage';
import { hydrate, serialize, validateSave } from '../src/store/save';

/**
 * `Num` is a plain double, and tiers are generated endlessly past Aether, so an
 * endgame run keeps climbing forever. Once any number reaches Infinity or NaN
 * it does not just look wrong — `validateSave` rejects non-finite fields, so
 * `loadFromStorage` throws the save away and the player restarts from zero.
 * That makes numeric integrity a save-safety property, not a cosmetic one.
 */

/** Every path in a state tree holding a non-finite number. */
function nonFinitePaths(v: unknown, path = '', out: string[] = []): string[] {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) out.push(`${path} = ${v}`);
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => nonFinitePaths(x, `${path}[${i}]`, out));
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) nonFinitePaths(x, path ? `${path}.${k}` : k, out);
  }
  return out;
}

/** The dev "next tier" path: satisfy the project, then use the real ascension. */
function forceAscend(s: GameState): void {
  s.megaproject.stagesAuthorized = s.megaproject.stages.length;
  s.megaproject.committed = s.megaproject.totalCost;
  ascend(s);
}

/** A tier's worth of aggressive play: buy everything affordable, then idle. */
function playTier(s: GameState, seconds: number): void {
  for (let i = 0; i < seconds; i++) {
    if (i % 30 === 0) for (const id of Object.keys(s.sources)) buy(s, id, 'max');
    tick(s, 1, () => 0.5); // deterministic market walk
  }
}

describe('numeric integrity at depth', () => {
  it('stays finite through 25 ascensions of hard play', () => {
    const s = createInitialState(0);
    s.stats.lifetimePower = 1e9; // past the progressive-unlock gates
    for (let tier = 0; tier < 25; tier++) {
      s.credits += 1e6 * Math.pow(10, tier); // a well-funded player for this tier
      playTier(s, 300);
      expect(nonFinitePaths(s), `went non-finite during tier ${tier}`).toEqual([]);
      forceAscend(s);
      expect(nonFinitePaths(s), `went non-finite ascending out of tier ${tier}`).toEqual([]);
    }
  });

  it('a deep save still round-trips through validate + hydrate', () => {
    const s = createInitialState(0);
    s.stats.lifetimePower = 1e9;
    for (let tier = 0; tier < 15; tier++) {
      s.credits += 1e6 * Math.pow(10, tier);
      playTier(s, 200);
      forceAscend(s);
    }
    // The real failure mode: a save that serializes but cannot be loaded back.
    const restored = hydrate(validateSave(JSON.parse(JSON.stringify(serialize(s)))));
    expect(nonFinitePaths(restored)).toEqual([]);
    expect(restored.tier).toBe(s.tier);
    expect(restored.kp).toBeCloseTo(s.kp);
  });

  it('a non-finite budget buys nothing instead of poisoning the run', () => {
    // Defence in depth. The run above says credits never actually reach
    // Infinity in 25 tiers of play — this guards the blast radius if some
    // future balance change ever gets them there. Buy-max used to hand out
    // Infinity units, which turns `owned`, then every output number, then the
    // save into NaN. The contract is "refuse the purchase", not "repair the
    // budget": an injected Infinity is still Infinity afterwards, and that's
    // fine, because nothing downstream was corrupted by it.
    for (const budget of [Number.POSITIVE_INFINITY, Number.NaN]) {
      const s = createInitialState(0);
      s.stats.lifetimePower = 1e9;
      s.credits = budget;
      const id = Object.keys(s.sources)[0];
      const before = s.sources[id].owned;
      expect(buy(s, id, 'max')).toBe(0);
      expect(s.sources[id].owned).toBe(before); // no free units
      expect(Object.is(s.credits, budget)).toBe(true); // balance untouched
    }
  });

  it('a NaN budget cannot be laundered into a purchase by an explicit count', () => {
    const s = createInitialState(0);
    s.stats.lifetimePower = 1e9;
    s.credits = Number.NaN;
    const id = Object.keys(s.sources)[0];
    expect(buy(s, id, 10)).toBe(0);
    expect(s.sources[id].owned).toBe(0);
  });

  it('no spend path anywhere hands out goods on a NaN balance', () => {
    // The whole reason `canAfford` exists rather than an inline comparison:
    // this is the check every future spend path has to inherit for free.
    const broke = () => {
      const s = createInitialState(0);
      s.stats.lifetimePower = 1e30; // past every unlock gate
      s.credits = Number.NaN;
      return s;
    };
    expect(buyGridUpgrade(broke(), 'v')).toBe(false);
    expect(buySolver(broke())).toBe(false);
    expect(buyPowerBoost(broke())).toBe(false);
    expect(buyRpBoost(broke())).toBe(false);
    expect(buyDispatchRecharge(broke())).toBe(false);

    const desk = broke();
    desk.sources[Object.keys(desk.sources)[0]].owned = 50; // give the battery capacity
    expect(arbitrageUnlocked(desk)).toBe(true); // guard the guard: gate is really open
    expect(chargeReserve(desk, 100)).toBe(false);
    expect(desk.reserve.stored).toBe(0);
  });
});
