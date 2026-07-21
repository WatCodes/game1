// Ambient flavor lines keyed to lifetime power — the world reacting to you.
// Shown under the world viewport; the highest passed threshold wins.
export const TRANSMISSIONS: [number, string][] = [
  [0, 'One paw kneads in the dark. A single filament glows.'],
  [1e3, 'The shrine lamps stay lit all night now.'],
  [1e5, 'The colony notices. Nine tails twitch in approval.'],
  [1e7, 'Athens never sleeps. The strays keep shifts.'],
  [1e9, 'Every road on the continent runs to your door.'],
  [1e11, 'Kittens are born already knowing the hum.'],
  [1e13, 'The old prides send envoys. You send a rate card.'],
  [1e16, 'Type I. The temple is yours now. Zeus can file a complaint.'],
  [1e19, 'Orbit is scaffolding. The sky has a skyline.'],
  [1e22, 'The star dims by design. Every astronomer is a cat, and they approve.'],
  [1e26, 'Type II. The sun is a sunbed.'],
  [1e29, 'Black holes spun like wheels. Something purrs at the event horizon.'],
  [1e33, 'The spiral arms light up one by one. Your meter reads on.'],
  [1e36, 'Type III. The galaxy hums at your frequency.'],
  [1e39, 'Spacetime pays the standing charge. Nine lives, nine realities.'],
];

export function transmissionFor(lifetimePower: number): string {
  let text = TRANSMISSIONS[0][1];
  for (const [at, line] of TRANSMISSIONS) {
    if (lifetimePower >= at) text = line;
    else break;
  }
  return text;
}
