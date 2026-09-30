/**
 * Every word the tutorial says. Design and rules: docs/TUTORIAL.md.
 *
 * Two sentences per beat, maximum. Players asked for clearer currencies *and*
 * fewer words; the way to get both is to say one thing at the moment it matters,
 * and leave the detail to the currency chips below.
 */

export type MomentId = 'credits' | 'altar' | 'research' | 'kp';

/** Order matters: when several are due at once, the earliest wins. */
export const MOMENT_ORDER: MomentId[] = ['credits', 'altar', 'research', 'kp'];

/**
 * `anchor` is the `data-tutorial` attribute of the control the beat points at.
 * `do` beats wait for the action; `tell` beats wait for a tap.
 */
export const MOMENTS: Record<MomentId, { style: 'do' | 'tell'; anchor: string; copy: string }> = {
  credits: {
    style: 'do',
    anchor: 'sources',
    copy: 'Credits (CR) buy power sources, and you have enough for a kneader. Open Power Sources and put one to work.',
  },
  altar: {
    style: 'do',
    anchor: 'altar',
    copy: 'The altar is charged. Tap it to channel a bolt — the burst sells straight for Credits.',
  },
  research: {
    style: 'do',
    anchor: 'rail-lab',
    copy: 'Research Points (RP) tick up on their own, even while you’re away. You can afford your first research — open the Lab.',
  },
  kp: {
    style: 'tell',
    anchor: 'rail-ascend',
    copy: 'Finish the Wonder and you can ascend: the city resets, but you keep Kardashev Points (KP). Every KP makes everything faster, forever.',
  },
};

/**
 * The long version, one card per header chip. Plain facts in the player's terms
 * — never a constant or formula name. Keep in step with the engine: if what
 * raises a currency changes, change its card in the same commit.
 */
export const CURRENCY_CARDS: Record<'cr' | 'rp' | 'kp', { title: string; lines: [string, string][] }> = {
  cr: {
    title: 'Credits · CR',
    lines: [
      ['What', 'Money. Everything you buy with it speeds you up.'],
      ['Earn', 'Sell power on the Dispatch Board, channel the altar, or solve boards in the Works.'],
      ['Raise', 'More generation, a higher sell share, and selling when the market price is high.'],
      ['Spend', 'Power sources, grid upgrades and the Agora.'],
    ],
  },
  rp: {
    title: 'Research Points · RP',
    lines: [
      ['What', 'Progress in the Lab. Research is permanent — it survives ascension.'],
      ['Earn', 'Automatically, every second — and at half rate while you’re away.'],
      ['Raise', 'Kardashev Points, certain research, and the Crash Program in the Agora.'],
      ['Spend', 'Research in the Lab, and authorizing Wonder stages.'],
    ],
  },
  kp: {
    title: 'Kardashev Points · KP',
    lines: [
      ['What', 'Permanent multipliers that survive every ascension.'],
      ['Earn', 'Ascend after finishing your era’s Wonder. More power this run, more KP.'],
      ['Raise', 'Generate more before you ascend.'],
      ['Effect', 'Each KP boosts all output, and adds to your research rate.'],
    ],
  },
};
