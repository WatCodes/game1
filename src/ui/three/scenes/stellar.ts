import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, addBackdrop, addLights, disposeGroup, glow, litCount, makeHalo, metal } from './shared';
import { starfield } from './orbital';

// T4 — a star being caged. Five Dyson rings mirror megaproject stage state
// exactly (built = solid cyan, authorized = amber, locked = faint), wrapped
// around a churning star with a corona, prominences and orbiting statites.
const RING_COUNT = 5;

export function stellarScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);
  addBackdrop(group, 0x08040c, 0x1a0a14);
  const stars = starfield(group, 90, 18);

  const star = new THREE.Mesh(new THREE.SphereGeometry(1.1, 40, 32), glow(0xffcf6a, 1.1));
  const corona = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 32, 24),
    new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0.2, side: THREE.BackSide, fog: false }),
  );
  const starHalo = makeHalo(0xffb24a, 5.5, 0.5);
  const starLight = new THREE.PointLight(0xffd27a, 45, 30);
  group.add(star, corona, starHalo, starLight);

  // Prominences: small flame cones flickering off the surface.
  const proms: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), glow(0xff8a3c, 1.2));
    p.position.set(Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0);
    p.lookAt(0, 0, 0);
    p.rotateX(Math.PI / 2);
    group.add(p);
    proms.push(p);
  }

  const rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: C.gridLine, transparent: true, opacity: 0.25, fog: false });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(1.9 + i * 0.75, 0.045, 8, 96), mat);
    mesh.rotation.x = Math.PI / 2 - (0.35 + i * 0.28);
    group.add(mesh);
    rings.push({ mesh, mat });
  }

  // Statite collectors riding the inner sphere, deploy with sources owned.
  const statites: THREE.Mesh[] = [];
  const statPivot = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), metal(0xd7e2f0));
    s.position.set(Math.cos(a) * 2.6, Math.sin(a * 1.5) * 0.5, Math.sin(a) * 2.6);
    statPivot.add(s);
    statites.push(s);
  }
  group.add(statPivot);

  return {
    group,
    orbit: { radius: 9.5, height: 3.2, speed: 0.06, targetY: 0 },
    update(data: SceneData, t: number) {
      star.scale.setScalar(1 + Math.sin(t * 1.4) * 0.03 + (data.surge ? 0.08 : 0));
      proms.forEach((p, i) => (p.scale.y = 0.7 + Math.abs(Math.sin(t * 2 + i)) * 0.8));
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
      const deployed = litCount(data.owned, statites.length, 0.9);
      statites.forEach((s, i) => (s.visible = i < deployed));
      statPivot.rotation.y = t * 0.12;
      stars.rotation.y = t * 0.003;
    },
    dispose: () => disposeGroup(group),
  };
}
