// Ambient flavor lines keyed to lifetime power — the world reacting to you.
// Shown under the world viewport; the highest passed threshold wins.
export const TRANSMISSIONS: [number, string][] = [
  [0, 'A single breaker hums in the dark.'],
  [1e3, 'The porch lights stay on all night now.'],
  [1e5, 'The neighborhood notices. Nobody asks questions yet.'],
  [1e7, 'The city never sleeps anymore. Neither do you.'],
  [1e9, 'Regional dispatch routes around you. You are the grid.'],
  [1e11, 'Datacenters migrate to be near your interties.'],
  [1e13, 'Nations negotiate for your baseload. You send a rate card.'],
  [1e16, 'A civilization of Type I. The textbooks add a chapter.'],
  [1e19, 'Orbit is scaffolding now. The sky has a skyline.'],
  [1e22, 'The star dims by design. Astronomers file complaints.'],
  [1e26, 'Type II. The sun is infrastructure.'],
  [1e29, 'Black holes spun like turbines. Physics files complaints.'],
  [1e33, 'The spiral arms light up one by one. Your meter reads on.'],
  [1e36, 'Type III. The galaxy hums at your frequency.'],
  [1e39, 'Spacetime itself pays the standing charge.'],
];

export function transmissionFor(lifetimePower: number): string {
  let text = TRANSMISSIONS[0][1];
  for (const [at, line] of TRANSMISSIONS) {
    if (lifetimePower >= at) text = line;
    else break;
  }
  return text;
}
