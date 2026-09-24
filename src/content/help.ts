/**
 * The Field Manual — player-facing reference for every system.
 *
 * Content, not logic: this is prose the player reads, so it lives here rather
 * than being inlined in a component. It is deliberately written from the
 * player's side of the screen — what a thing does and when to care about it —
 * and never names a file, constant or formula.
 *
 * Keep it honest. A manual that describes a system the game no longer has is
 * worse than no manual, and docs/GAME_DESIGN.md §3.8 spent two mechanics
 * describing a puzzle that had already been replaced. If you change a system,
 * change its entry in the same commit.
 *
 * Keep it short, too. Players reported the game had too many words, and a
 * reference nobody finishes is a reference nobody reads. One idea per line; if a
 * sentence restates the one before it, cut it.
 */
export interface HelpSection {
  id: string;
  title: string;
  body: string[];
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'loop',
    title: 'The loop',
    body: [
      'Sources make Watts. Watts sell for Credits. Research Points tick up on their own.',
      'Spend Research in the Lab, finish the Wonder, then ascend: you lose the buildout, keep permanent multipliers, and rebuild faster.',
      'Nothing is on a timer. Leave for a week — the grid keeps running.',
    ],
  },
  {
    id: 'sources',
    title: 'Power sources',
    body: [
      'Each source adds output and costs upkeep. The panel shows both. If upkeep outruns output, it is a bad buy.',
      'Every 25 of one source doubles its output. Go deep before you go wide.',
    ],
  },
  {
    id: 'transmission',
    title: 'Transmission',
    body: [
      'Generated is not delivered. The lines lose some, and the grid has a hard carrying cap.',
      'Transformers lift the cap and cut loss. Conductors lift the cap. Superconductors cut loss.',
      'When the panel flags a lane, that is the one to buy.',
    ],
  },
  {
    id: 'dispatch',
    title: 'Dispatch',
    body: [
      'The sell slider sets how much delivered power becomes Credits. The rest stays as Watts.',
      'Selling hard floods the market and the price sags; easing off lets it recover. No wrong setting — just Credits now against a better rate later.',
    ],
  },
  {
    id: 'lab',
    title: 'The Lab',
    body: [
      'Research is permanent and survives ascension. It unlocks sources, automation, and the key project each tier needs.',
      'Research Points accrue on their own, even while the app is closed — at a reduced rate.',
    ],
  },
  {
    id: 'wonder',
    title: 'The Wonder',
    body: [
      'Each tier has one megaproject. Finishing it unlocks Ascension.',
      'The route slider diverts generation into construction. Too much browns out the grid — raise it until the header complains, then back off.',
      'Each stage grants a permanent multiplier. Later ones need that tier’s key research first.',
    ],
  },
  {
    id: 'works',
    title: 'The Works',
    body: [
      'A board of feeders. Every row and column carries each load once, and a mark between two feeders opens toward the bigger draw.',
      'Tap a feeder to cycle its load. Clashes turn red as you go.',
      'Solving pays Credits and lights the Grid Surge. Re-dealing is free. Auto-Solvers from the Agora grind boards in the background.',
      'Entirely optional — nothing is gated behind it.',
    ],
  },
  {
    id: 'agora',
    title: 'The Agora',
    body: [
      'Credits buy speed, never progress. Everything here is a shortcut.',
      'The daily tribute grows on a streak. Miss one day and it is forgiven; miss two and it resets.',
      'The Arbitrage Desk stores Watts and sells them back later. Demand drifts on its own, storage loses a little in the round trip, and there is no clock — hold as long as you like.',
    ],
  },
  {
    id: 'ascend',
    title: 'Ascension',
    body: [
      'Ascending resets sources, stored power and the megaproject. You keep Kardashev Points, research and Research Points.',
      'Kardashev Points multiply output forever. Ascending is always a gain — the reset is the point.',
    ],
  },
  {
    id: 'away',
    title: 'Away time',
    body: [
      'The grid runs while the app is closed or in the background. Come back to a summary, with an optional video to double it.',
      'Short absences arrive as a note instead of a summary, so an app-switch never interrupts play.',
      'Research banks while you are away too, at a reduced rate. Very long absences stop paying eventually.',
    ],
  },
];
