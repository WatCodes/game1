// Per-tier skin for Feeder Balance — same constraint mechanic, escalating
// fiction. Every row and column carries each load level once; the ‹ › marks
// between neighbours say which of the pair must draw more.
//
// Flavour deliberately never spells out "row" and "column": the panel's rule
// line teaches that once, and restating it in eight voices reads as
// instructions rather than as a world.
//
// One line each, not two. Every skin used to state the no-repeats rule *and*
// the marks rule, which meant the player read the same instruction nine times
// over a run — once in the Field Manual, once in the coach, and again in every
// era's voice. These name the place; the rules are taught elsewhere.
const SKINS: [string, string][] = [
  ['Athens Wards', 'No two wards on a line may draw alike.'],
  ['Colony Dispatch', 'Every feeder takes its own share.'],
  ['World Hearth Trim', 'One draw of each along every run.'],
  ['Orbital Load Board', 'Each truss bus carries its own tap.'],
  ['Swarm Regulator', 'No statite doubles up along a line.'],
  ['Ergosphere Governor', 'Each frame-drag tap sits at its own depth.'],
  ['Galactic Load Web', 'One draw of each per arm.'],
  ['Lattice Damper', 'Every kernel node takes a distinct amplitude.'],
];

export function puzzleSkin(tier: number): { name: string; flavor: string } {
  const skin = SKINS[tier];
  if (skin) return { name: skin[0], flavor: skin[1] };
  return {
    name: `Exotic Regulator Δ-${tier - 7}`,
    flavor: 'One draw of each, and every mark obeyed.',
  };
}
