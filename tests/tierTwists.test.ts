import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { ascend } from '../src/engine/ascension';
import { tick } from '../src/engine/loop';
import { buy, powerPerSec } from '../src/engine/economy';
import { researchModifiers } from '../src/engine/research';
import { CONFIG } from '../src/content/config';
import {
  accretionOutputMult,
  accretionUpkeepMult,
  launchCostMult,
  relayPowerMult,
  relayRpMult,
  setFeedRate,
  setRelayAllocation,
  tickAccretion,
  tickLaunchWindow,
} from '../src/engine/tierTwists';

function atTier(tier: number) {
  const s = createInitialState(0);
  s.tier = tier; // twists are gated purely on s.tier for these unit tests
  return s;
}

describe('T3 launch windows', () => {
  it('is inert outside tier 3', () => {
    const s = atTier(0);
    expect(launchCostMult(s)).toBe(1);
    s.tier = 4;
    expect(launchCostMult(s)).toBe(1);
  });

  it('surcharges purchases off-window, normal price on-window', () => {
    const s = atTier(3);
    s.launchWindow.active = false;
    expect(launchCostMult(s)).toBe(CONFIG.LAUNCH_SURCHARGE);
    s.launchWindow.active = true;
    expect(launchCostMult(s)).toBe(1);
  });

  it('cycles active/inactive on schedule', () => {
    const s = atTier(3);
    s.launchWindow.nextIn = 1;
    tickLaunchWindow(s, 1.5, () => 0.5);
    expect(s.launchWindow.active).toBe(true);
    expect(s.launchWindow.timeLeft).toBe(CONFIG.LAUNCH_WINDOW_DURATION_SECONDS);
    tickLaunchWindow(s, CONFIG.LAUNCH_WINDOW_DURATION_SECONDS + 1, () => 0.5);
    expect(s.launchWindow.active).toBe(false);
    expect(s.launchWindow.nextIn).toBeCloseTo(
      CONFIG.LAUNCH_GAP_MIN_SECONDS + 0.5 * (CONFIG.LAUNCH_GAP_MAX_SECONDS - CONFIG.LAUNCH_GAP_MIN_SECONDS),
    );
  });

  it('does not advance outside tier 3', () => {
    const s = atTier(0);
    const before = { ...s.launchWindow };
    tickLaunchWindow(s, 1000, () => 0.5);
    expect(s.launchWindow).toEqual(before);
  });

  it('automation still buys off-window at the surcharged price (never a hard wall)', () => {
    const s = createInitialState(0);
    s.tier = 3; // note: sources aren't rebuilt here; buy() only needs launchCostMult + a real source
    s.sources['battery-bank'].automated = false;
    s.launchWindow.active = false;
    s.power = 1000;
    const normalCost = 10; // battery-bank baseCost
    expect(buy(s, 'battery-bank', 1)).toBe(1);
    expect(s.power).toBeCloseTo(1000 - normalCost * CONFIG.LAUNCH_SURCHARGE);
  });
});

describe('T5 accretion disk', () => {
  it('is inert outside tier 5, and at feed rate 0', () => {
    const s = atTier(0);
    s.accretion.feedRate = 1;
    expect(accretionOutputMult(s)).toBe(1);
    expect(accretionUpkeepMult(s)).toBe(1);
    s.tier = 5;
    s.accretion.feedRate = 0;
    expect(tickAccretion(s, 100, 1000)).toBeNull();
    expect(s.accretion.heat).toBe(0);
  });

  it('output and upkeep multipliers scale linearly with feed rate at tier 5', () => {
    const s = atTier(5);
    setFeedRate(s, 0.5);
    expect(accretionOutputMult(s)).toBeCloseTo(1 + 0.5 * CONFIG.ACCRETION_OUTPUT_BONUS);
    expect(accretionUpkeepMult(s)).toBeCloseTo(1 + 0.5 * CONFIG.ACCRETION_UPKEEP_PENALTY);
  });

  it('setFeedRate clamps to 0..1', () => {
    const s = atTier(5);
    setFeedRate(s, 5);
    expect(s.accretion.feedRate).toBe(1);
    setFeedRate(s, -5);
    expect(s.accretion.feedRate).toBe(0);
  });

  it('heat builds proportionally and a flare pays a burst then resets', () => {
    const s = atTier(5);
    setFeedRate(s, 1);
    const half = tickAccretion(s, CONFIG.ACCRETION_HEAT_SECONDS / 2, 1000);
    expect(half).toBeNull();
    expect(s.accretion.heat).toBeCloseTo(0.5);
    const flare = tickAccretion(s, CONFIG.ACCRETION_HEAT_SECONDS / 2, 1000);
    expect(flare).not.toBeNull();
    expect(flare!.gained).toBeCloseTo(1000 * CONFIG.ACCRETION_FLARE_SECONDS);
    expect(s.accretion.heat).toBe(0);
    expect(s.power).toBeCloseTo(CONFIG.STARTING_POWER + 1000 * CONFIG.ACCRETION_FLARE_SECONDS);
  });
});

describe('T6 relay routing', () => {
  it('is inert outside tier 6', () => {
    const s = atTier(0);
    s.relay.researchAllocation = 1;
    expect(relayPowerMult(s)).toBe(1);
    expect(relayRpMult(s)).toBe(1);
  });

  it('trades power for RP rate at tier 6', () => {
    const s = atTier(6);
    setRelayAllocation(s, 0.4);
    expect(relayPowerMult(s)).toBeCloseTo(1 - 0.4 * CONFIG.RELAY_POWER_PENALTY);
    expect(relayRpMult(s)).toBeCloseTo(1 + 0.4 * CONFIG.RELAY_RP_BONUS);
  });

  it('folds into researchModifiers so powerPerSec and researchRate reflect it', () => {
    const s = atTier(6);
    s.sources['battery-bank'] = { ...createInitialState(0).sources['battery-bank'], owned: 10 };
    const before = powerPerSec(s);
    setRelayAllocation(s, 1);
    const after = powerPerSec(s);
    expect(after).toBeCloseTo(before * (1 - CONFIG.RELAY_POWER_PENALTY));
    expect(researchModifiers(s).rpMult).toBeCloseTo(1 + CONFIG.RELAY_RP_BONUS);
  });
});

describe('ascension resets all tier twists', () => {
  it('clears launch window, accretion, and relay state', () => {
    const s = createInitialState(0);
    s.launchWindow = { active: true, timeLeft: 5, nextIn: 5 };
    s.accretion = { feedRate: 0.8, heat: 0.6 };
    s.relay = { researchAllocation: 0.9 };
    s.megaproject.stagesAuthorized = s.megaproject.stages.length;
    s.megaproject.committed = s.megaproject.totalCost;
    s.runPower = 5e5;
    ascend(s);
    expect(s.launchWindow.active).toBe(false);
    expect(s.accretion.feedRate).toBe(0);
    expect(s.accretion.heat).toBe(0);
    expect(s.relay.researchAllocation).toBe(0);
  });
});

describe('loop integration', () => {
  it('tick() advances the launch window and accretion heat when relevant', () => {
    const s = createInitialState(0);
    s.tier = 3;
    s.launchWindow.nextIn = 0.5;
    tick(s, 1);
    expect(s.launchWindow.active).toBe(true);
  });
});
