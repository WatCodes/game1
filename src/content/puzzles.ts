// Per-tier skin for the Load Balancer — same lights-out mechanic, escalating
// fiction. Tap a district to shed its load (and its neighbors'); balance them all.
const SKINS: [string, string][] = [
  ['Athens Wards', 'The wards are drawing too much. Tap one to shed its load — it ripples to the neighbours. Settle them all.'],
  ['Colony Dispatch', 'Even out the feeders — every colony must sit in the green band.'],
  ['World Hearth Trim', 'Damp the hot blocks; each tap cools its cluster. Settle the whole hearth.'],
  ['Orbital Load Board', 'Balance the truss buses so no docking ring browns out.'],
  ['Swarm Regulator', 'Trim the statite array — no cell may run hot.'],
  ['Ergosphere Governor', 'Tame the frame-drag taps; leave none over-drawn.'],
  ['Galactic Load Web', 'Shed load across the arms until the whole web runs cool.'],
  ['Lattice Damper', 'Quiet every over-resonant kernel node.'],
];

export function puzzleSkin(tier: number): { name: string; flavor: string } {
  const skin = SKINS[tier];
  if (skin) return { name: skin[0], flavor: skin[1] };
  return {
    name: `Exotic Regulator Δ-${tier - 7}`,
    flavor: 'Balance the impossible.',
  };
}
