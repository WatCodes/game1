// Per-tier skin for Feeder Balance — same constraint mechanic, escalating
// fiction. Every row and column carries each load level once; the ‹ › marks
// between neighbours say which of the pair must draw more.
//
// Flavour deliberately never spells out "row" and "column": the panel's rule
// line teaches that once, and restating it in eight voices reads as
// instructions rather than as a world.
const SKINS: [string, string][] = [
  ['Athens Wards', 'No two wards on a line may draw the same. Mind the marks — they say who outdraws whom.'],
  ['Colony Dispatch', 'Every feeder takes its own share. The marks fix the pecking order between neighbours.'],
  ['World Hearth Trim', 'One draw of each along every run. The marks name the greater of each pair.'],
  ['Orbital Load Board', 'Each truss bus carries its own tap. Respect the marks between adjacent rings.'],
  ['Swarm Regulator', 'No statite doubles up along a line. The marks rank each neighbouring pair.'],
  ['Ergosphere Governor', 'Each frame-drag tap sits at its own depth. The marks hold the order between them.'],
  ['Galactic Load Web', 'One draw of each per arm. The marks decide which node runs hotter.'],
  ['Lattice Damper', 'Every kernel node takes a distinct amplitude. The marks fix the gradient.'],
];

export function puzzleSkin(tier: number): { name: string; flavor: string } {
  const skin = SKINS[tier];
  if (skin) return { name: skin[0], flavor: skin[1] };
  return {
    name: `Exotic Regulator Δ-${tier - 7}`,
    flavor: 'One draw of each, and every mark obeyed.',
  };
}
