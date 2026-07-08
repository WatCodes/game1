import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, addBackdrop, disposeGroup, glow, makeHalo } from './shared';
import { starfield } from './orbital';

// T6 — the galaxy webbed. A dense two-arm spiral of stars; the lit (cyan)
// fraction grows from the core outward with milestones and buildout. A bright
// haloed core and a scatter of field stars sell the scale.
const ARM_POINTS = 240; // per arm

export function galacticScene(): TierScene {
  const group = new THREE.Group();
  addBackdrop(group, 0x04040e, 0x0c0820);
  starfield(group, 120, 24);

  const total = ARM_POINTS * 2;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < ARM_POINTS; i++) {
      const f = i / ARM_POINTS;
      const angle = f * Math.PI * 3.6 + arm * Math.PI;
      const r = 0.4 + f * 5.4;
      const spread = 0.55 - f * 0.3;
      const idx = (arm * ARM_POINTS + i) * 3;
      positions[idx] = Math.cos(angle) * r + (Math.random() - 0.5) * spread;
      positions[idx + 1] = (Math.random() - 0.5) * (0.55 - f * 0.4);
      positions[idx + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * spread;
      sizes[arm * ARM_POINTS + i] = 0.1 + Math.random() * 0.1;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95 }));
  group.add(points);

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 20), glow(0xe6c2ff, 1.3));
  const coreHalo = makeHalo(0xc79bff, 4.5, 0.6);
  group.add(core, coreHalo);

  const litColor = new THREE.Color(C.cyan);
  const dimColor = new THREE.Color(0x2a2550);
  let lastLit = -1;

  return {
    group,
    orbit: { radius: 9.5, height: 4.5, speed: 0.05, targetY: 0 },
    update(data: SceneData, t: number) {
      const litPerArm = Math.min(ARM_POINTS, Math.round(ARM_POINTS * Math.min(1, (data.milestones * 2 + Math.sqrt(data.owned)) / 40)));
      if (litPerArm !== lastLit) {
        const attr = geo.getAttribute('color') as THREE.BufferAttribute;
        for (let arm = 0; arm < 2; arm++) {
          for (let i = 0; i < ARM_POINTS; i++) {
            const c = i < litPerArm ? litColor : dimColor;
            attr.setXYZ(arm * ARM_POINTS + i, c.r, c.g, c.b);
          }
        }
        attr.needsUpdate = true;
        lastLit = litPerArm;
      }
      group.rotation.y = t * 0.05;
      core.scale.setScalar(1 + Math.sin(t * 1.8) * 0.06 + (data.surge ? 0.12 : 0));
    },
    dispose: () => disposeGroup(group),
  };
}
