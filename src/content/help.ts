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
      'Power sources generate Watts. Watts sell for Credits, and the research trickle earns Research Points on its own.',
      'Spend Research Points in the Lab, build the Wonder to unlock Ascension, then ascend — you lose the buildout and keep permanent multipliers, and everything runs bigger the next time around.',
      'Nothing here is on a timer you can miss. Leave for a week and the grid keeps running.',
    ],
  },
  {
    id: 'sources',
    title: 'Power sources',
    body: [
      'Each source adds output and costs upkeep. Net output is what reaches the meter, so a source that costs more upkeep than it makes is a bad buy — the panel shows both.',
      'Every 25 of one source doubles that source’s output. Buying in tens toward the next ×2 is usually better than spreading thin.',
    ],
  },
  {
    id: 'transmission',
    title: 'Transmission',
    body: [
      'Generated power is not delivered power. Some is lost in the lines, and there is a hard cap on how much the grid can carry.',
      'Raising voltage lifts the cap and cuts loss; heavier conductors lift the cap; a better bus cuts loss. If the meter says generation exceeds the cap, you are burning output you already paid for — fix the grid before buying more sources.',
    ],
  },
  {
    id: 'dispatch',
    title: 'Dispatch',
    body: [
      'The sell slider decides how much delivered power converts to Credits. The rest stays as Watts.',
      'Selling floods the market and the price sags; easing off lets it recover. There is no wrong setting, only a trade between Credits now and a better rate later.',
    ],
  },
  {
    id: 'lab',
    title: 'The Lab',
    body: [
      'Research is permanent and survives ascension. It unlocks new sources, automation, and the key project each tier needs before its Wonder can finish.',
      'Research Points accumulate on their own, so the Lab keeps moving even when you are not playing.',
    ],
  },
  {
    id: 'wonder',
    title: 'The Wonder',
    body: [
      'Each tier has one signature megaproject, and finishing it is what unlocks Ascension.',
      'The route slider diverts a share of generation into construction. Divert too much and the grid browns out — the header will say so — so raise it until the warning appears, then back off.',
      'Each completed stage grants a permanent multiplier for the rest of the run. Later stages need that tier’s key research first.',
    ],
  },
  {
    id: 'works',
    title: 'The Works',
    body: [
      'A board of feeders. Every row and column carries each load level exactly once, and a mark between two feeders opens toward the one drawing more.',
      'Tap a feeder to cycle its load. Cells that clash turn red as you go, so you always know where you went wrong without being told the answer.',
      'Solving pays Credits and lights the Grid Surge, a temporary boost to all output. Re-dealing is free and costs you nothing but the board. Auto-Solvers from the Agora grind boards for you in the background.',
      'It is optional. Nothing in the game is gated behind it.',
    ],
  },
  {
    id: 'agora',
    title: 'The Agora',
    body: [
      'Credits buy speed, never progress. Everything here is a shortcut you could reach anyway.',
      'The daily tribute grows on a streak. Missing one day is forgiven; missing two resets it.',
      'The Arbitrage Desk stores Watts in a battery and sells them back later. Demand drifts on its own, storage has a round-trip loss, and there is no clock — you can hold a position indefinitely, so nothing is ever at risk.',
    ],
  },
  {
    id: 'ascend',
    title: 'Ascension',
    body: [
      'Ascending resets your sources, stored power and megaproject, and keeps Kardashev Points, all research and Research Points.',
      'Kardashev Points multiply output permanently, across every future run. Ascending is always a gain, never a setback — the reset is the point.',
    ],
  },
  {
    id: 'away',
    title: 'Away time',
    body: [
      'The grid runs while the app is closed. Reopen after a couple of minutes and you get a summary of what it earned, with an optional video to double it.',
      'Shorter absences still pay out — they just arrive as a small note instead of a full summary, so an app-switch never interrupts play.',
      'The offline rate is generous but not unlimited, so very long absences do not pay forever.',
    ],
  },
];
