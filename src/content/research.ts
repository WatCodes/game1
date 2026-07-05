import type { ResearchNode } from '../engine/types';
import { sourceNamesForTier } from './sources';

// RP cost baseline per tier. RP income compounds via multRpRate nodes, so later
// tiers cost more but idle time between ascensions covers the gap.
const RP_BASE = [20, 150, 800, 4000, 2e4, 1e5, 5e5, 2.5e6];

// Flavor per tier for the formulaic node kinds:
// [unlock3, unlock4, boostFirst, global, rp, auto0, auto1, mega, offline?]
const FLAVOR: (string | null)[][] = [
  ['Steam Cycles', 'Brayton Cycle', 'Advanced Chemistry', 'Turbo-Alternators', 'Grid Telemetry', 'Battery Management AI', 'Genset Dispatcher', 'Prefab Substations', 'Night-Shift Crews'],
  ['Deep Hydro', 'Enhanced Geothermal', 'Perovskite Cells', 'HVDC Backbone', 'Forecast Models', 'Solar Trackers', 'Turbine Yaw AI', 'Modular Converters', null],
  ['Ignition Milestone', null, 'High-Flux Cores', 'Superconducting Grid', 'Plasma Diagnostics', 'Reactor Autopilot', null, 'Tokamak Mass Production', 'Autonomous Ops'],
  ['Penning Traps', null, 'Thin-Film Arrays', 'Orbital Logistics', 'Deep Space Network', 'Station-Keeping AI', null, 'Mass Driver Exports', null],
  ['Swarm Coordination', null, 'Chromospheric Mining', 'Statite Lattice', 'Stellar Cartography', 'Autonomous Foundries', null, 'Self-Replicating Fabs', null],
  ['Nested Shells', null, 'Ergosphere Tuning', 'Exotic Matter Refinery', 'Singularity Lab', 'Accretion Autopilot', null, 'Frame-Drag Anchors', null],
  ['Relay Lattice', null, 'Magnetar Harnessing', 'Galactic Logistics Web', 'SETI Archives', 'Von Neumann Fleets', null, 'Warp-Lane Freight', null],
  ['False Vacuum Baffles', null, 'Casimir Amplifiers', 'Planck-Scale Engineering', 'Omega Archive', 'Acausal Schedulers', null, 'Spacetime Scaffolds', null],
];

/** The full permanent tech tree, tiers 0–7. */
export function buildResearch(): ResearchNode[] {
  const nodes: ResearchNode[] = [];
  for (let tier = 0; tier < FLAVOR.length; tier++) {
    const R = RP_BASE[tier];
    const srcs = sourceNamesForTier(tier);
    const [unlock3, unlock4, boost, global, rp, auto0, auto1, mega, offline] = FLAVOR[tier];
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
  }
  return nodes;
}
