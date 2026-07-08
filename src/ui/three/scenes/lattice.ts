import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, addBackdrop, addLights, disposeGroup, glow, litCount, makeHalo, makeInstanced } from './shared';
import { starfield } from './orbital';

// T7+ — the vacuum lattice: a 3×3×3 cage of kernel nodes energizing one by
// one as the impossible gets built, threaded by an edge web and centered on a
// pulsing resonant core.
const GRID = 3;
const SPACING = 1.7;

export function latticeScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);
  addBackdrop(group, 0x0a0420, 0x1a0a30);
  starfield(group, 70, 20);

  const nodePositions: THREE.Vector3[] = [];
  for (let x = 0; x < GRID; x++)
    for (let y = 0; y < GRID; y++)
      for (let z = 0; z < GRID; z++)
        nodePositions.push(new THREE.Vector3((x - 1) * SPACING, (y - 1) * SPACING, (z - 1) * SPACING));

  const nodes = makeInstanced(new THREE.IcosahedronGeometry(0.24), new THREE.MeshBasicMaterial({ fog: false }), nodePositions);
  group.add(nodes.mesh);

  const edgeVerts: number[] = [];
  nodePositions.forEach((a, i) => {
    nodePositions.forEach((b, j) => {
      if (j <= i) return;
      if (a.distanceTo(b) < SPACING + 0.01) edgeVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    });
  });
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeVerts), 3));
  const edges = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ color: 0x3a2a66, transparent: true, opacity: 0.7, fog: false }),
  );
  group.add(edges);

  const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), glow(C.cyan, 1.4));
  const heartHalo = makeHalo(C.cyan, 3, 0.6);
  group.add(heart, heartHalo);

  let lastLit = -1;
  return {
    group,
    orbit: { radius: 8.5, height: 3, speed: 0.06, targetY: 0 },
    update(data: SceneData, t: number) {
      const lit = litCount(data.owned, nodePositions.length, 1.2);
      if (lit !== lastLit) {
        for (let i = 0; i < nodePositions.length; i++) nodes.setColor(i, i < lit ? C.violet : 0x1a1230);
        lastLit = lit;
      }
      group.rotation.y = t * 0.12;
      group.rotation.x = Math.sin(t * 0.07) * 0.25;
      const pulse = 1 + Math.sin(t * 2.2) * 0.15 + (data.surge ? 0.2 : 0);
      heart.scale.setScalar(pulse);
      heart.rotation.y = t * 0.5;
    },
    dispose: () => disposeGroup(group),
  };
}
