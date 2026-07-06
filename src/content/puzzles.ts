// Per-tier skin for the circuit puzzle — same mechanic, escalating fiction.
const SKINS: [string, string][] = [
  ['Relay Yard', 'Rotate the switchyard relays until every district is on the line.'],
  ['Substation Maze', 'Re-route the regional feeders — every substation needs a live path.'],
  ['Reactor Loom', 'Weave the coolant-loop bus so each reactor block stays energized.'],
  ['Orbital Bus', 'Align the station truss conduits — power every docking ring.'],
  ['Statite Web', 'Trim the swarm relays until each statite catches the beam.'],
  ['Ergosphere Circuit', 'Thread the frame-drag taps — every collector must close the loop.'],
  ['Relay Galaxy', 'Chain the warp-lane couplers so each arm of the web goes live.'],
  ['Planck Lattice', 'Fold the vacuum lattice until every kernel node resonates.'],
];

export function puzzleSkin(tier: number): { name: string; flavor: string } {
  const skin = SKINS[tier];
  if (skin) return { name: skin[0], flavor: skin[1] };
  return {
    name: `Exotic Circuit Δ-${tier - 7}`,
    flavor: 'Rotate the impossible until it hums.',
  };
}
