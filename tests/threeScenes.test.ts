import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sceneForTier } from '../src/ui/three/scenes';
import { fossilScene } from '../src/ui/three/scenes/fossil';
import { stellarScene } from '../src/ui/three/scenes/stellar';
import { exoticScene } from '../src/ui/three/scenes/exotic';
import { litCount, makeInstanced } from '../src/ui/three/scenes/shared';
import type { SceneData } from '../src/ui/three/types';

// three.js scene graphs construct fine in Node — no WebGL needed until
// render(). That lets us verify every scene's data bindings headlessly.

const IDLE: SceneData = {
  owned: 0, milestones: 0, stagesDone: 0, stagesAuth: 1,
  surge: false, live: false, feedRate: 0, heat: 0,
};

const BUSY: SceneData = {
  owned: 5000, milestones: 12, stagesDone: 5, stagesAuth: 5,
  surge: true, live: true, feedRate: 1, heat: 0.9,
};

describe('every tier scene', () => {
  it('builds, updates across extreme data, and disposes without throwing', () => {
    for (let tier = 0; tier <= 9; tier++) {
      const scene = sceneForTier(tier)();
      expect(scene.group.children.length).toBeGreaterThan(0);
      expect(scene.orbit.radius).toBeGreaterThan(0);
      // idle → busy → long-t updates must all be safe
      scene.update(IDLE, 0);
      scene.update(BUSY, 1.5);
      scene.update(BUSY, 100_000); // hours of uptime — no NaN/overflow behavior
      scene.group.traverse((obj) => {
        expect(Number.isFinite(obj.position.x)).toBe(true);
        expect(Number.isFinite(obj.rotation.y)).toBe(true);
      });
      scene.dispose();
    }
  });

  it('tiers beyond the table reuse the lattice scene', () => {
    expect(sceneForTier(7)).toBe(sceneForTier(20));
  });
});

describe('fossil scene data bindings', () => {
  function hiddenCount(scene: ReturnType<typeof fossilScene>): number {
    let n = 0;
    scene.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && !obj.visible) n++;
    });
    return n;
  }

  it('traffic, blimp and searchlights hide when the grid is not live', () => {
    const scene = fossilScene();
    scene.update({ ...IDLE, live: true }, 2);
    const liveHidden = hiddenCount(scene);
    scene.update({ ...IDLE, live: false }, 2);
    const idleHidden = hiddenCount(scene);
    // Motion elements (2 traffic streams + blimp + 2 searchlights) go dark.
    expect(idleHidden).toBeGreaterThan(liveHidden);
    expect(idleHidden - liveHidden).toBeGreaterThanOrEqual(4);
    scene.dispose();
  });

  it('windows light up as sources are owned', () => {
    const scene = fossilScene();
    const windows = () =>
      scene.group.children.find((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh | undefined;
    scene.update({ ...IDLE, owned: 0 }, 1);
    const dark = new THREE.Color();
    windows()!.getColorAt(0, dark);
    scene.update({ ...IDLE, owned: 4000 }, 1);
    const bright = new THREE.Color();
    windows()!.getColorAt(0, bright);
    // instance 0 goes from near-black to lit amber
    expect(bright.r + bright.g + bright.b).toBeGreaterThan(dark.r + dark.g + dark.b);
    scene.dispose();
  });
});

describe('stellar scene ring states', () => {
  function ringMaterials(scene: ReturnType<typeof stellarScene>): THREE.MeshBasicMaterial[] {
    const mats: THREE.MeshBasicMaterial[] = [];
    scene.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry?.type === 'TorusGeometry') mats.push(mesh.material as THREE.MeshBasicMaterial);
    });
    return mats;
  }

  it('rings mirror megaproject stage state: done > authorized > locked', () => {
    const scene = stellarScene();
    scene.update({ ...IDLE, stagesDone: 2, stagesAuth: 4 }, 1);
    const mats = ringMaterials(scene);
    expect(mats).toHaveLength(5);
    // 0-1 done (cyan, near-opaque), 2-3 authorized (amber), 4 locked (dim)
    expect(mats[0].opacity).toBeGreaterThan(0.9);
    expect(mats[1].opacity).toBeGreaterThan(0.9);
    expect(mats[2].opacity).toBeCloseTo(0.6);
    expect(mats[3].opacity).toBeCloseTo(0.6);
    expect(mats[4].opacity).toBeLessThan(0.3);
    scene.dispose();
  });
});

describe('exotic scene accretion bindings', () => {
  it('feed rate opens the jets and brightens the disk; heat whitens it', () => {
    const scene = exoticScene();
    const disks: THREE.MeshBasicMaterial[] = [];
    scene.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry?.type === 'TorusGeometry') disks.push(mesh.material as THREE.MeshBasicMaterial);
    });
    const disk = disks[0];
    scene.update({ ...IDLE, live: true, feedRate: 0, heat: 0 }, 1);
    const coldColor = disk.color.clone();
    const coldOpacity = disk.opacity;
    scene.update({ ...IDLE, live: true, feedRate: 1, heat: 1 }, 2);
    expect(disk.opacity).toBeGreaterThan(coldOpacity);
    // heated disk shifts toward white — every channel rises or holds
    expect(disk.color.r).toBeGreaterThanOrEqual(coldColor.r);
    expect(disk.color.b).toBeGreaterThan(coldColor.b);
    scene.dispose();
  });
});

describe('shared helpers', () => {
  it('litCount is sub-linear and clamped', () => {
    expect(litCount(0, 10)).toBe(0);
    expect(litCount(1, 10)).toBe(2); // ceil(1 × 1.6)
    expect(litCount(1e9, 10)).toBe(10);
  });

  it('makeInstanced positions every instance and recolors on demand', () => {
    const positions = [new THREE.Vector3(1, 2, 3), new THREE.Vector3(-4, 0, 2)];
    const { mesh, setColor } = makeInstanced(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      positions,
    );
    expect(mesh.count).toBe(2);
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    expect(p.x).toBe(1);
    expect(p.z).toBe(3);
    setColor(1, 0xff0000);
    const c = new THREE.Color();
    mesh.getColorAt(1, c);
    expect(c.r).toBeCloseTo(1);
    expect(c.g).toBeCloseTo(0);
  });
});
