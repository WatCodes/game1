import type * as THREE from 'three';

/** Everything a tier scene reads — same fields that drive the 2D diorama. */
export interface SceneData {
  owned: number; // total units across sources
  milestones: number; // global milestones this run
  stagesDone: number;
  stagesAuth: number;
  surge: boolean;
  live: boolean; // pps > 0
  feedRate: number; // T5 accretion twist
  heat: number; // T5 accretion heat 0..1
}

/** How the camera should drift around this scene. */
export interface CameraOrbit {
  radius: number;
  height: number;
  speed: number; // radians/sec
  targetY: number;
}

export interface TierScene {
  group: THREE.Group;
  orbit: CameraOrbit;
  /** Called every rendered frame. t = seconds since scene mount. */
  update(data: SceneData, t: number): void;
  dispose(): void;
}

export type SceneFactory = () => TierScene;
