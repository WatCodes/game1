import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { nextObjective } from '../src/engine/objectives';
import { buyResearch } from '../src/engine/research';
import { CONFIG } from '../src/content/config';

function state() {
  return createInitialState(0);
}

describe('nextObjective', () => {
  it('opens by naming the very first thing to do', () => {
    const s = state();
    const o = nextObjective(s)!;
    expect(o.id).toBe('first-source');
    // reads with the live (reskinned) source name, never a hardcoded one
    expect(o.text).toContain(s.sources['battery-bank'].name);
  });

  it('walks the opening beats in order', () => {
    const s = state();
    s.sources['battery-bank'].owned = 1;
    expect(nextObjective(s)!.id).toBe('grow');

    s.sources['battery-bank'].owned = 5;
    expect(nextObjective(s)!.id).toBe('first-research');

    s.rp = 1e9;
    buyResearch(s, 'boost-battery-bank');
    expect(nextObjective(s)!.id).toBe('unlock-board');

    s.stats.lifetimePower = CONFIG.UNLOCK_BOARD_POWER;
    expect(nextObjective(s)!.id).toBe('route');
  });

  it('points at whatever is actually blocking the build', () => {
    const s = state();
    s.sources['battery-bank'].owned = 5;
    s.rp = 1e9;
    buyResearch(s, 'boost-battery-bank');
    s.stats.lifetimePower = CONFIG.UNLOCK_BOARD_POWER;
    s.megaproject.committed = 1; // routing has started

    // stage 2 needs no research, so it is authorizable
    expect(nextObjective(s)!.id).toBe('authorize');

    // ...but stage 3 is gated behind research
    s.megaproject.stagesAuthorized = 2;
    expect(nextObjective(s)!.id).toBe('stage-research');
  });

  it('ends the tier by pointing at ascension', () => {
    const s = state();
    s.sources['battery-bank'].owned = 5;
    s.rp = 1e9;
    buyResearch(s, 'boost-battery-bank');
    s.stats.lifetimePower = CONFIG.UNLOCK_BOARD_POWER;
    s.megaproject.committed = s.megaproject.totalCost;
    const o = nextObjective(s)!;
    expect(o.id).toBe('ascend');
    expect(o.text).toContain(s.megaproject.name);
  });
});
