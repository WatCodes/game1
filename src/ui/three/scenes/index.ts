import type { SceneFactory } from '../types';
import { fossilScene } from './fossil';
import { renewableScene } from './renewable';
import { atomicScene } from './atomic';
import { orbitalScene } from './orbital';
import { stellarScene } from './stellar';
import { exoticScene } from './exotic';
import { galacticScene } from './galactic';
import { latticeScene } from './lattice';

const SCENES: SceneFactory[] = [
  fossilScene,
  renewableScene,
  atomicScene,
  orbitalScene,
  stellarScene,
  exoticScene,
  galacticScene,
  latticeScene, // T7 and the procedural tail beyond
];

export function sceneForTier(tier: number): SceneFactory {
  return SCENES[Math.min(tier, SCENES.length - 1)];
}
