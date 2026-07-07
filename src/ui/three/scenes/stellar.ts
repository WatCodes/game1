import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, addLights, disposeGroup, glow } from './shared';
import { starfield } from './orbital';

// T4 — a star being caged. Five Dyson rings mirror megaproject stage state
// exactly: built = solid cyan, authorized = amber, locked = barely there.
const RING_COUNT = 5;

export function stellarScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);

  const star = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 16), glow(C.amber, 1));
  const corona = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 20, 16),
    new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0.18, side: THREE.BackSide }),
  );
  const starLight = new THREE.PointLight(C.amber, 40, 30);
  group.add(star, corona, starLight);

  const rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; tilt: number }[] = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: C.gridLine, transparent: true, opacity: 0.25 });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(1.9 + i * 0.75, 0.035, 8, 72), mat);
    const tilt = 0.35 + i * 0.28;
    mesh.rotation.x = Math.PI / 2 - tilt;
    group.add(mesh);
    rings.push({ mesh, mat, tilt });
  }

  const stars = starfield(group, 70, 16);

  return {
    group,
    orbit: { radius: 9.5, height: 3.2, speed: 0.06, targetY: 0 },
    update(data: SceneData, t: number) {
      star.scale.setScalar(1 + Math.sin(t * 1.4) * 0.03 + (data.surge ? 0.08 : 0));
      rings.forEach((r, i) => {
        r.mesh.rotation.z = t * (0.1 + i * 0.04) * (i % 2 === 0 ? 1 : -1);
        if (i < data.stagesDone) {
          r.mat.color.setHex(C.cyan);
          r.mat.opacity = 0.95;
        } else if (i < data.stagesAuth) {
          r.mat.color.setHex(C.amberDim);
          r.mat.opacity = 0.6;
        } else {
          r.mat.color.setHex(C.gridLine);
          r.mat.opacity = 0.25;
        }
      });
      stars.rotation.y = t * 0.004;
    },
    dispose: () => disposeGroup(group),
  };
}
