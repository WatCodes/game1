import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, disposeGroup, glow } from './shared';

// T6 — the galaxy webbed. A two-arm spiral of points; the lit (cyan) fraction
// grows with milestones and buildout, mirroring the 2D web.
const ARM_POINTS = 130; // per arm

export function galacticScene(): TierScene {
  const group = new THREE.Group();
  // No lambert lights needed — everything here is self-lit.

  const total = ARM_POINTS * 2;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < ARM_POINTS; i++) {
      const t = i / ARM_POINTS;
      const angle = t * Math.PI * 3.4 + arm * Math.PI;
      const r = 0.5 + t * 5.2;
      const idx = (arm * ARM_POINTS + i) * 3;
      positions[idx] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.5;
      positions[idx + 1] = (Math.random() - 0.5) * (0.5 - t * 0.35);
      positions[idx + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.5;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 0.14, vertexColors: true, sizeAttenuation: true }),
  );
  group.add(points);

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), glow(C.violet, 1));
  const coreHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 16, 12),
    new THREE.MeshBasicMaterial({ color: C.violet, transparent: true, opacity: 0.25, side: THREE.BackSide }),
  );
  group.add(core, coreHalo);

  const litColor = new THREE.Color(C.cyan);
  const dimColor = new THREE.Color(C.gridLine);
  let lastLit = -1;

  return {
    group,
    orbit: { radius: 9.5, height: 4.5, speed: 0.05, targetY: 0 },
    update(data: SceneData, t: number) {
      // Both arms light from the core outward as the web energizes.
      const litPerArm = Math.min(
        ARM_POINTS,
        Math.round(ARM_POINTS * Math.min(1, (data.milestones * 2 + Math.sqrt(data.owned)) / 40)),
      );
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
