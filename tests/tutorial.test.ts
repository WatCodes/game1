import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { momentDue, momentSatisfied, tutorialSnapshot } from '../src/engine/tutorial';
import { effectiveCost } from '../src/engine/megaproject';
import { isResearchAvailable } from '../src/engine/research';
import { CONFIG } from '../src/content/config';
import { MOMENT_ORDER, MOMENTS } from '../src/content/tutorial';
import type { GameState } from '../src/engine/types';

const fresh = (): GameState => createInitialState(0);

/** A brand-new player a moment after buying their first kneader. */
function started(): GameState {
  const s = fresh();
  s.sources['battery-bank'].owned = 1;
  return s;
}

/** A player a few hours in who has ascended once and owns nothing again. */
function veteranAfterAscending(): GameState {
  const s = fresh();
  s.stats.ascensions = 1;
  s.stats.lifetimePower = 5e9;
  s.kp = 12;
  return s;
}

function firstAffordableResearch(s: GameState) {
  return Object.values(s.research).find((n) => isResearchAvailable(s, n))!;
}

describe('credits', () => {
  it('is due for a brand-new player', () => {
    expect(momentDue(fresh(), 'credits')).toBe(true);
  });

  it('is satisfied the moment a source is owned', () => {
    expect(momentSatisfied(started(), 'credits')).toBe(true);
    expect(momentDue(started(), 'credits')).toBe(false);
  });

  it('never fires for a veteran who owns nothing after ascending', () => {
    // The case that matters: ascension resets sources to zero, so "owns
    // nothing" alone would teach a veteran to buy a kneader.
    expect(momentDue(veteranAfterAscending(), 'credits')).toBe(false);
  });
});

describe('altar', () => {
  it('waits until tapping it would work', () => {
    const s = started();
    s.dispatch.charge = 0;
    expect(momentDue(s, 'altar')).toBe(false); // generating, not charged
    s.dispatch.charge = CONFIG.DISPATCH_MIN_CHARGE;
    expect(momentDue(s, 'altar')).toBe(true);
  });

  it('never fires with no generation, however charged', () => {
    // The 1.0.1 Channel bug in tutorial form: a full altar with nothing to
    // dispatch does nothing when tapped, so it must not be taught then.
    const s = fresh();
    s.dispatch.charge = 1;
    expect(momentDue(s, 'altar')).toBe(false);
  });

  it('skips a save that is plainly past the opening', () => {
    const s = started();
    s.dispatch.charge = 1;
    s.stats.lifetimePower = CONFIG.TUTORIAL_ALTAR_MAX_LIFETIME;
    expect(momentDue(s, 'altar')).toBe(false);
  });

  it('is never satisfied from state — the UI watches for the channel', () => {
    const s = started();
    s.dispatch.charge = 1;
    expect(momentSatisfied(s, 'altar')).toBe(false);
  });
});

describe('research', () => {
  it('is due when the first research becomes affordable', () => {
    const s = started();
    const node = firstAffordableResearch(s);
    s.rp = node.cost - 1;
    expect(momentDue(s, 'research')).toBe(false);
    s.rp = node.cost;
    expect(momentDue(s, 'research')).toBe(true);
  });

  it('is satisfied, and no longer due, once anything is researched', () => {
    const s = started();
    const node = firstAffordableResearch(s);
    s.rp = node.cost * 10;
    node.purchased = true;
    expect(momentSatisfied(s, 'research')).toBe(true);
    expect(momentDue(s, 'research')).toBe(false);
  });
});

describe('kardashev points', () => {
  it('fires as the Wonder nears completion, not before', () => {
    const s = started();
    const total = effectiveCost(s);
    s.megaproject.committed = total * (CONFIG.TUTORIAL_KP_PROGRESS - 0.05);
    expect(momentDue(s, 'kp')).toBe(false);
    s.megaproject.committed = total * CONFIG.TUTORIAL_KP_PROGRESS;
    expect(momentDue(s, 'kp')).toBe(true);
  });

  it('never fires for anyone who has already ascended', () => {
    const s = veteranAfterAscending();
    s.megaproject.committed = effectiveCost(s);
    expect(momentDue(s, 'kp')).toBe(false);
  });
});

describe('content', () => {
  it('keeps every beat to two sentences', () => {
    // The playtest ask was clearer *and* shorter. This holds the second half.
    for (const id of MOMENT_ORDER) {
      const sentences = MOMENTS[id].copy.split(/[.!?](?:\s|$)/).filter((x) => x.trim());
      expect(sentences.length, id).toBeLessThanOrEqual(2);
    }
  });

  it('snapshots every moment', () => {
    const snap = tutorialSnapshot(fresh());
    expect(Object.keys(snap.due).sort()).toEqual([...MOMENT_ORDER].sort());
  });
});
