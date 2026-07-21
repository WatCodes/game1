import type { ResearchNode } from '../engine/types';
import { sourceNamesForTier } from './sources';

// RP cost baseline per tier. RP income compounds via multRpRate nodes, so later
// tiers cost more but idle time between ascensions covers the gap.
export const RP_BASE = [20, 150, 800, 4000, 2e4, 1e5, 5e5, 2.5e6];

// Flavor per tier for the formulaic node kinds. Node descriptions are generated
// from the live source names, so a source reskin flows through automatically.
// [unlock3, unlock4, boostFirst, global, rp, auto0, auto1, mega, offline?,
//  efficiency, credits?, demand?, salvage?]
// The last three are the Dispatch Board levers (§3.15). They compound, so they
// are deliberately NOT on every tier: credits ×8, demand ×4, salvage ×3 — enough
// to feel like mastery without erasing the brownout tension entirely.
const FLAVOR: (string | null)[][] = [
  ['Sisal Windings', 'Midnight Zoomies', 'Deeper Kneading', 'Static Cling', 'Curiosity', 'Kneading Rota', 'Yarn Wardens', 'Temple Masonry', 'Night Shift', 'Lean Rations', 'Fish Market Contracts', 'Shuttered Windows', null],
  ['Aqueduct Craft', 'Deep Hearths', 'Longer Naps', 'Sunward Tilt', 'Colony Archives', 'Nap Wardens', 'Whisker Calibration', 'Road Surveyors', null, 'Grooming Discipline', 'Caravan Charters', null, null],
  ['Pride Ignition', null, 'Resonant Purring', 'Superconducting Fur', 'Nine Lives Telemetry', 'Purr Autopilot', null, 'Hearth Mass Production', 'Autonomous Prides', 'Closed Fuel Cycle', 'World Exchange', 'Efficient Wards', 'Reclaimed Cores'],
  ['Penning Traps', null, 'Thin-Film Arrays', 'Orbital Logistics', 'Deep-Space Whiskers', 'Station-Keeping AI', null, 'Mass Driver Exports', 'Autonomous Relays', 'Self-Healing Panels', 'Orbital Freight Rights', null, null],
  ['Swarm Coordination', null, 'Chromospheric Mining', 'Statite Lattice', 'Stellar Cartography', 'Autonomous Foundries', null, 'Self-Replicating Fabs', null, 'Zero-Loss Relays', 'Solar Tariffs', 'Dimmed Hemispheres', 'Foundry Reclamation'],
  ['Nested Shells', null, 'Ergosphere Tuning', 'Exotic Matter Refinery', 'Singularity Lab', 'Accretion Autopilot', null, 'Frame-Drag Anchors', 'Deep-Time Buffers', 'Entropy Recycling', 'Event-Horizon Futures', null, null],
  ['Relay Lattice', null, 'Magnetar Harnessing', 'Galactic Logistics Web', 'Archive of Nine Lives', 'Von Neumann Prides', null, 'Warp-Lane Freight', null, 'Lossless Lanes', 'Arm-Wide Charters', 'Quiet Arms', 'Fleet Reclamation'],
  ['False Vacuum Baffles', null, 'Casimir Amplifiers', 'Planck-Scale Engineering', 'Omega Archive', 'Acausal Schedulers', null, 'Spacetime Scaffolds', null, 'Perpetual Bearings', 'Aether Concessions', null, null],
];

/** The full permanent tech tree, tiers 0–7. */
export function buildResearch(): ResearchNode[] {
  const nodes: ResearchNode[] = [];
  for (let tier = 0; tier < FLAVOR.length; tier++) {
    const R = RP_BASE[tier];
    const srcs = sourceNamesForTier(tier);
    const [unlock3, unlock4, boost, global, rp, auto0, auto1, mega, offline, efficiency, credits, demand, salvage] =
      FLAVOR[tier];
    const [id0, name0] = srcs[0];
    const [id1, name1] = srcs[1];
    const [id2, name2] = srcs[2];

    nodes.push({
      id: `unlock-${id2}`, name: unlock3!, tier, cost: R, prereqs: [],
      desc: `Unlock the ${name2}.`,
      effect: { kind: 'unlockSource', sourceId: id2 },
    });
    if (unlock4 && srcs[3]) {
      const [id3, name3] = srcs[3];
      nodes.push({
        id: `unlock-${id3}`, name: unlock4, tier, cost: 3 * R, prereqs: [`unlock-${id2}`],
        desc: `Unlock the ${name3}.`,
        effect: { kind: 'unlockSource', sourceId: id3 },
      });
    }
    nodes.push({
      id: `boost-${id0}`, name: boost!, tier, cost: 1.5 * R, prereqs: [],
      desc: `${name0} output ×2.`,
      effect: { kind: 'multSource', sourceId: id0, x: 2 },
    });
    nodes.push({
      id: `global-t${tier}`, name: global!, tier, cost: 4 * R, prereqs: [`boost-${id0}`],
      desc: 'All power output ×1.5.',
      effect: { kind: 'multGlobal', x: 1.5 },
    });
    nodes.push({
      id: `rp-t${tier}`, name: rp!, tier, cost: 2.5 * R, prereqs: [],
      desc: 'Research rate ×1.75.',
      effect: { kind: 'multRpRate', x: 1.75 },
    });
    nodes.push({
      id: `auto-${id0}`, name: auto0!, tier, cost: 5 * R, prereqs: [],
      desc: `A manager auto-buys ${name0}s while affordable.`,
      effect: { kind: 'unlockAutomation', sourceId: id0 },
    });
    if (auto1) {
      nodes.push({
        id: `auto-${id1}`, name: auto1, tier, cost: 8 * R, prereqs: [`auto-${id0}`],
        desc: `A manager auto-buys ${name1}s while affordable.`,
        effect: { kind: 'unlockAutomation', sourceId: id1 },
      });
    }
    nodes.push({
      id: `mega-t${tier}`, name: mega!, tier, cost: 4 * R, prereqs: [],
      desc: 'Megaproject cost −15%.',
      effect: { kind: 'reduceMegaprojectCost', x: 0.15 },
    });
    if (offline) {
      nodes.push({
        id: `offline-t${tier}`, name: offline, tier, cost: 3 * R, prereqs: [],
        desc: 'Offline earnings cap +4h.',
        effect: { kind: 'increaseOfflineCap', seconds: 14400 },
      });
    }
    nodes.push({
      id: `eff-t${tier}`, name: efficiency!, tier, cost: 2 * R, prereqs: [],
      desc: 'All upkeep −50%.',
      effect: { kind: 'reduceUpkeep', x: 0.5 },
    });
    // --- Dispatch Board levers: one per rail ---
    if (credits) {
      nodes.push({
        id: `credits-t${tier}`, name: credits, tier, cost: 3 * R, prereqs: [],
        desc: 'Power sells for +25% CR.',
        effect: { kind: 'multCredits', x: 1.25 },
      });
    }
    if (demand) {
      nodes.push({
        id: `demand-t${tier}`, name: demand, tier, cost: 3.5 * R, prereqs: [],
        desc: 'Grid demand −20% — sell more before browning out.',
        effect: { kind: 'reduceDemand', x: 0.2 },
      });
    }
    if (salvage) {
      nodes.push({
        id: `salvage-t${tier}`, name: salvage, tier, cost: 4.5 * R, prereqs: [],
        desc: 'Megaproject stages dismantle 30% fewer plants.',
        effect: { kind: 'reduceDecommission', x: 0.3 },
      });
    }
  }
  return nodes;
}
