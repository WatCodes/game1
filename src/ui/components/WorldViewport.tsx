import { Suspense, lazy, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { transmissionFor } from '../../content/transmissions';
import { audioEnabled, setAudioEnabled } from '../audio';
import { webglAvailable } from '../three/support';
import type { SceneData } from '../three/types';
import { SceneErrorBoundary } from './SceneErrorBoundary';

// Code-split: three.js only downloads when the 3D view actually mounts.
const Scene3DInner = lazy(() => import('./WorldViewport3D'));

function Scene3D(props: { tier: number; data: SceneData; onFail: () => void }) {
  return (
    <SceneErrorBoundary onError={props.onFail}>
      <Suspense fallback={<div className="h-40 w-full" aria-hidden />}>
        <Scene3DInner {...props} />
      </Suspense>
    </SceneErrorBoundary>
  );
}

// The living world: one panel that redraws from game state and levels up with
// each ascension. Every scene is driven by data the display already carries.

interface Scene {
  owned: number; // total units across sources
  milestones: number; // global milestones this run
  stagesDone: number;
  stagesAuth: number;
  surge: boolean;
  live: boolean; // pps > 0
}

/** Sub-linear ramp so early buys visibly change the world. */
function litCount(owned: number, max: number, k = 1.6): number {
  return Math.min(max, Math.ceil(Math.sqrt(owned) * k));
}

// Ruined Athens: low broken houses either side of the Temple of Zeus, whose
// precinct (x ≈ 138–222) is kept clear.
const RUINS: [number, number, number][] = [
  [16, 26, 22], [48, 30, 15], [86, 22, 28], [114, 20, 12],
  [228, 24, 26], [258, 30, 14], [294, 22, 24], [324, 20, 11],
];
const BRAZIERS: [number, number][] = [
  [12, 91], [40, 91], [74, 91], [104, 91], [130, 91],
  [232, 91], [262, 91], [292, 91], [320, 91], [346, 91],
  [150, 74], [212, 74],
];
const COLUMNS = [146, 158, 170, 182, 194, 206];

function AthensScene({ owned, surge, live }: Scene) {
  const lit = litCount(owned, BRAZIERS.length, 2);
  return (
    <>
      {/* moon */}
      <circle cx={318} cy={20} r={8} fill="var(--bg-raised)" stroke="var(--grid-line)" />
      <ellipse className="cloud" cx={-30} cy={26} rx={22} ry={5} fill="var(--bg-raised)" opacity={0.5} />
      {surge && <rect x={0} y={88} width={360} height={4} fill="var(--cyan)" opacity={0.35} />}
      <line x1={0} y1={95} x2={360} y2={95} stroke="var(--grid-line)" strokeWidth={2} />

      {/* ruined houses, some with a toppled column beside them */}
      {RUINS.map(([x, w, h], i) => (
        <g key={i}>
          <rect x={x} y={95 - h} width={w} height={h} fill="var(--bg-raised)" />
          {i % 2 === 0 && <rect x={x - 10} y={92} width={9} height={3} rx={1.5} fill="var(--bg-raised)" />}
        </g>
      ))}

      {/* Temple of Zeus */}
      <rect x={136} y={80} width={88} height={4} fill="var(--bg-raised)" />
      <rect x={140} y={74} width={80} height={6} fill="var(--bg-raised)" />
      {COLUMNS.map((x, i) => (
        <rect key={i} x={x} y={i === 4 ? 58 : 50} width={5} height={i === 4 ? 16 : 24} fill="var(--bg-raised)" />
      ))}
      <rect x={140} y={44} width={80} height={6} fill="var(--bg-raised)" />
      <polygon points="140,44 180,28 220,44" fill="var(--bg-raised)" />

      {/* the stolen spark, crackling between the columns */}
      {live && (
        <polyline
          className="flicker"
          points="164,52 172,60 166,64 176,72"
          fill="none"
          stroke="var(--cyan)"
          strokeWidth={1.6}
          opacity={surge ? 1 : 0.8}
        />
      )}

      {/* braziers light as generators come online */}
      {BRAZIERS.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={2.6}
          className={i === 3 && i < lit ? 'flicker' : ''}
          fill={i < lit ? 'var(--amber)' : 'var(--bg-panel)'}
        />
      ))}

      {live && (
        <>
          <circle className="smoke" cx={150} cy={70} r={4} fill="var(--grid-line)" />
          <circle className="smoke" cx={212} cy={68} r={3} fill="var(--grid-line)" style={{ animationDelay: '1.4s' }} />
          {/* cats padding along the avenue — eyes catching the firelight */}
          <g className="drive">
            <ellipse cx={-10} cy={101} rx={6} ry={2.4} fill="var(--bg-raised)" />
            <circle cx={-5} cy={100} r={1.3} fill="var(--amber)" />
          </g>
          <g className="drive" style={{ animationDelay: '-4.5s', animationDuration: '12s' }}>
            <ellipse cx={-10} cy={106} rx={5} ry={2} fill="var(--bg-raised)" />
            <circle cx={-6} cy={105} r={1.1} fill="var(--ok)" />
          </g>
        </>
      )}
    </>
  );
}

function RenewableScene({ owned, surge, live }: Scene) {
  const panels = litCount(owned, 6);
  return (
    <>
      <circle cx={40} cy={26} r={11} fill="var(--amber)" opacity={surge ? 1 : 0.6} />
      <ellipse className="cloud" cx={-30} cy={20} rx={26} ry={6} fill="var(--bg-raised)" opacity={0.55} />
      <ellipse className="cloud" cx={-30} cy={38} rx={18} ry={4} fill="var(--bg-raised)" opacity={0.4} style={{ animationDelay: '-12s' }} />
      <ellipse cx={90} cy={125} rx={160} ry={42} fill="var(--bg-raised)" />
      <ellipse cx={300} cy={132} rx={170} ry={48} fill="var(--bg-raised)" />
      {[100, 190, 285].map((x, i) => (
        <g key={i}>
          <line x1={x} y1={92 - i * 4} x2={x} y2={52 - i * 4} stroke="var(--text-dim)" strokeWidth={2.5} />
          <g
            className={live ? 'turbine-spin' : ''}
            style={{ transformOrigin: `${x}px ${52 - i * 4}px`, animationDelay: `${i * 0.7}s` }}
          >
            {/* four sailcloth arms — a windmill, not a wind turbine */}
            {[0, 90, 180, 270].map((a) => (
              <line
                key={a} x1={x} y1={52 - i * 4}
                x2={x + 16 * Math.cos(((a - 90) * Math.PI) / 180)}
                y2={52 - i * 4 + 16 * Math.sin(((a - 90) * Math.PI) / 180)}
                stroke="var(--text)" strokeWidth={3}
              />
            ))}
          </g>
        </g>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <rect
          key={i} x={18 + i * 22} y={96} width={18} height={7}
          transform={`skewX(-18)`}
          fill={i < panels ? 'var(--amber)' : 'var(--bg-panel)'} stroke="var(--grid-line)"
        />
      ))}
    </>
  );
}

const PLANET_CITIES: [number, number][] = [
  [156, 36], [204, 40], [218, 62], [188, 78], [152, 72], [136, 55], [172, 56], [208, 88], [148, 90], [178, 24],
];

function PlanetScene({ owned, milestones, surge }: Scene) {
  const lit = Math.min(PLANET_CITIES.length, milestones + litCount(owned, 6, 0.8));
  return (
    <>
      {[[30, 18], [320, 70], [60, 82], [292, 22]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.2} fill="var(--text-dim)" />
      ))}
      <circle cx={178} cy={57} r={44} fill="var(--bg-raised)" stroke={surge ? 'var(--cyan)' : 'var(--grid-line)'} strokeWidth={1.5} />
      <ellipse cx={178} cy={57} rx={44} ry={15} fill="none" stroke="var(--cyan-dim)" strokeWidth={1} opacity={0.7} />
      <ellipse cx={178} cy={57} rx={17} ry={44} fill="none" stroke="var(--cyan-dim)" strokeWidth={1} opacity={0.7} />
      {PLANET_CITIES.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.4} fill={i < lit ? 'var(--amber)' : 'var(--bg-panel)'} />
      ))}
      {PLANET_CITIES.slice(0, Math.max(0, lit - 1)).map(([x, y], i) => {
        const [nx, ny] = PLANET_CITIES[i + 1];
        return (
          <line key={i} className="power-flow" x1={x} y1={y} x2={nx} y2={ny} stroke="var(--amber)" strokeWidth={0.8} opacity={0.7} />
        );
      })}
      <g className="orbit" style={{ transformOrigin: '178px 57px' }}>
        <circle cx={272} cy={34} r={5} fill="var(--bg-raised)" stroke="var(--grid-line)" />
      </g>
    </>
  );
}

function OrbitalScene({ owned, stagesDone, surge }: Scene) {
  const sats = litCount(owned, 7, 1);
  return (
    <>
      {[[40, 14], [110, 28], [230, 10], [318, 40], [70, 52], [290, 66]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.2} fill="var(--text-dim)" />
      ))}
      <circle cx={180} cy={210} r={130} fill="var(--bg-raised)" stroke={surge ? 'var(--cyan)' : 'var(--cyan-dim)'} strokeWidth={1.5} />
      <ellipse
        className="power-flow"
        cx={180} cy={96} rx={150} ry={34} fill="none" stroke="var(--grid-line)" strokeWidth={1}
      />
      {Array.from({ length: 7 }, (_, i) => {
        const a = Math.PI * (0.18 + (i * 0.64) / 6);
        const x = 180 - 150 * Math.cos(a);
        const y = 96 - 34 * Math.sin(a);
        return (
          <g key={i} opacity={i < sats ? 1 : 0.25}>
            <rect x={x - 6} y={y - 2.5} width={12} height={5} fill={i < sats ? 'var(--cyan)' : 'var(--bg-panel)'} />
            <line x1={x} y1={y - 5} x2={x} y2={y + 5} stroke="var(--text-dim)" strokeWidth={1} />
          </g>
        );
      })}
      {stagesDone >= 2 && <line x1={180} y1={82} x2={180} y2={108} stroke="var(--amber)" strokeWidth={1.5} strokeDasharray="4 3" />}
    </>
  );
}

function DysonScene({ stagesDone, stagesAuth, surge, live }: Scene) {
  return (
    <>
      {[[36, 16], [104, 40], [250, 14], [326, 52], [66, 88], [300, 92]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.2} fill="var(--text-dim)" />
      ))}
      <circle cx={180} cy={55} r={18} fill="var(--amber)" opacity={surge ? 1 : 0.85} />
      {live &&
        [0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line
            key={a}
            x1={180 + 22 * Math.cos((a * Math.PI) / 180)} y1={55 + 22 * Math.sin((a * Math.PI) / 180)}
            x2={180 + 27 * Math.cos((a * Math.PI) / 180)} y2={55 + 27 * Math.sin((a * Math.PI) / 180)}
            stroke="var(--amber)" strokeWidth={1.5}
          />
        ))}
      {Array.from({ length: 5 }, (_, i) => {
        const rx = 40 + i * 20;
        const done = i < stagesDone;
        const auth = i < stagesAuth;
        return (
          <ellipse
            key={i} cx={180} cy={55} rx={rx} ry={rx * 0.32} fill="none"
            className={done ? 'power-flow' : ''}
            stroke={done ? 'var(--cyan)' : auth ? 'var(--amber-dim)' : 'var(--grid-line)'}
            strokeWidth={done ? 2 : 1.2}
            strokeDasharray={done ? undefined : auth ? '18 8' : '3 8'}
          />
        );
      })}
    </>
  );
}

function ExoticScene({ owned, surge, live }: Scene) {
  const taps = litCount(owned, 5, 0.8);
  return (
    <>
      {[[40, 12], [120, 30], [250, 12], [320, 44], [80, 80], [296, 88]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.2} fill="var(--text-dim)" />
      ))}
      <circle cx={180} cy={55} r={16} fill="var(--bg)" stroke="var(--violet)" strokeWidth={2} />
      <g className="orbit" style={{ transformOrigin: '180px 55px', animationDuration: '7s' }}>
        <ellipse cx={180} cy={55} rx={52} ry={13} fill="none" stroke="var(--amber)" strokeWidth={3} opacity={surge ? 1 : 0.75} strokeDasharray="60 22" />
      </g>
      {live && (
        <>
          <line x1={180} y1={30} x2={180} y2={8} stroke="var(--cyan)" strokeWidth={2} />
          <line x1={180} y1={80} x2={180} y2={102} stroke="var(--cyan)" strokeWidth={2} />
        </>
      )}
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 + 0.5;
        return (
          <circle
            key={i} cx={180 + 72 * Math.cos(a)} cy={55 + 26 * Math.sin(a)} r={3.5}
            fill={i < taps ? 'var(--cyan)' : 'var(--bg-raised)'} stroke="var(--grid-line)"
          />
        );
      })}
    </>
  );
}

const GALAXY_NODES: [number, number][] = Array.from({ length: 16 }, (_, i) => {
  const t = 0.9 + i * 0.42;
  return [180 + t * 16 * Math.cos(t) * 1.6, 55 + t * 16 * Math.sin(t) * 0.55];
});

function GalaxyScene({ owned, milestones, surge }: Scene) {
  const lit = Math.min(GALAXY_NODES.length, milestones * 2 + litCount(owned, 6, 0.8));
  return (
    <>
      {[[30, 90], [330, 16], [50, 20], [310, 86]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.2} fill="var(--text-dim)" />
      ))}
      <circle cx={180} cy={55} r={9} fill="var(--violet)" opacity={surge ? 1 : 0.85} />
      {GALAXY_NODES.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.2} fill={i < lit ? 'var(--cyan)' : 'var(--text-dim)'} opacity={i < lit ? 1 : 0.5} />
      ))}
      {GALAXY_NODES.slice(0, Math.max(0, lit - 1)).map(([x, y], i) => {
        const [nx, ny] = GALAXY_NODES[i + 1];
        return (
          <line key={i} className="power-flow" x1={x} y1={y} x2={nx} y2={ny} stroke="var(--cyan-dim)" strokeWidth={0.9} />
        );
      })}
    </>
  );
}

function LatticeScene({ owned, surge }: Scene) {
  const lit = litCount(owned, 15, 1.2);
  const nodes = Array.from({ length: 15 }, (_, i) => [52 + (i % 5) * 64, 22 + Math.floor(i / 5) * 33] as const);
  return (
    <>
      {nodes.map(([x, y], i) =>
        nodes.slice(i + 1).map(([nx, ny], j) =>
          Math.abs(nx - x) + Math.abs(ny - y) <= 70 ? (
            <line key={`${i}-${j}`} x1={x} y1={y} x2={nx} y2={ny} stroke="var(--grid-line)" strokeWidth={1} />
          ) : null,
        ),
      )}
      {nodes.map(([x, y], i) => (
        <circle
          key={i} cx={x} cy={y} r={i === 7 ? 6 : 3.5}
          className={i === 7 && surge ? 'lattice-pulse' : ''}
          fill={i < lit ? 'var(--violet)' : 'var(--bg-raised)'}
          stroke={i < lit ? 'var(--violet)' : 'var(--grid-line)'}
        />
      ))}
    </>
  );
}

const SCENES = [AthensScene, RenewableScene, PlanetScene, OrbitalScene, DysonScene, ExoticScene, GalaxyScene, LatticeScene];

export function WorldViewport() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('kardashev:ui:viewport') === '0');
  // Preference is state; capability is checked at render time. Deciding
  // capability once at mount was a real bug: a page that loads while the
  // window is hidden probes WebGL as unavailable and would lock into 2D.
  // Render-time checks self-heal on the next display publish (~12 Hz).
  const [wants3d, setWants3d] = useState(() => localStorage.getItem('kardashev:ui:3d') !== '0');
  const use3d = wants3d && webglAvailable();
  const tier = useGame((s) => s.display.tier);
  const sources = useGame((s) => s.display.sources);
  const milestones = useGame((s) => s.display.globalMilestones);
  const mega = useGame((s) => s.display.mega);
  const boosts = useGame((s) => s.display.boosts);
  const pps = useGame((s) => s.display.pps);
  const lifetimePower = useGame((s) => s.display.lifetimePower);
  const tierTwist = useGame((s) => s.display.tierTwist);

  const toggle = () => {
    localStorage.setItem('kardashev:ui:viewport', collapsed ? '1' : '0');
    setCollapsed(!collapsed);
  };

  const toggle3d = () => {
    localStorage.setItem('kardashev:ui:3d', wants3d ? '0' : '1');
    setWants3d(!wants3d);
  };

  const scene: Scene = {
    owned: sources.reduce((sum, s) => sum + s.owned, 0),
    milestones,
    stagesDone: mega.stages.filter((st) => st.complete).length,
    stagesAuth: mega.stagesAuthorized,
    surge: boosts.surgeLeft > 0 || boosts.powerLeft > 0,
    live: pps > 0,
  };
  const sceneData: SceneData = {
    ...scene,
    feedRate: tierTwist.kind === 'accretion' ? tierTwist.feedRate : 0,
    heat: tierTwist.kind === 'accretion' ? tierTwist.heat : 0,
  };
  const Scene = SCENES[Math.min(tier, SCENES.length - 1)];

  const [sound, setSound] = useState(audioEnabled);
  const toggleSound = () => {
    setAudioEnabled(!sound);
    setSound(!sound);
  };

  // One-time "drag to rotate" nudge — the 3D camera is swipeable but there's
  // nothing to signal it. Show once, then remember it's been seen.
  const [showHint, setShowHint] = useState(() => localStorage.getItem('kardashev:ui:3dhint') !== '0');
  const dismissHint = () => {
    if (!showHint) return;
    localStorage.setItem('kardashev:ui:3dhint', '0');
    setShowHint(false);
  };

  return (
    <div className="relative border-b border-line/60 bg-transparent">
      <button
        className="absolute right-2 top-1 z-10 px-1 font-mono text-[10px] text-ink-dim hover:text-ink"
        onClick={toggle}
        aria-label={collapsed ? 'Expand world view' : 'Collapse world view'}
      >
        {collapsed ? '▾ world' : '▴'}
      </button>
      <button
        className={`absolute right-10 top-1 z-10 px-1 font-mono text-[10px] ${sound ? 'text-current' : 'text-ink-dim'} hover:text-ink`}
        onClick={toggleSound}
        aria-label={sound ? 'Mute audio' : 'Enable audio'}
      >
        {sound ? '♪ on' : '♪ off'}
      </button>
      {webglAvailable() && (
        <button
          className={`absolute right-[4.5rem] top-1 z-10 px-1 font-mono text-[10px] ${use3d ? 'text-current' : 'text-ink-dim'} hover:text-ink`}
          onClick={toggle3d}
          aria-pressed={use3d}
          aria-label={use3d ? 'Switch world view to 2D' : 'Switch world view to 3D'}
        >
          {use3d ? '◆ 3d' : '◇ 2d'}
        </button>
      )}
      {!collapsed && (
        <>
          {use3d ? (
            <div className="relative" onPointerDown={dismissHint}>
              <Scene3D tier={tier} data={sceneData} onFail={() => setWants3d(false)} />
              {showHint && (
                <div className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border border-line/60 bg-panel/70 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-dim">
                  drag to rotate
                </div>
              )}
            </div>
          ) : (
            <svg viewBox="0 0 360 110" className="block w-full" role="img" aria-label="Your civilization, drawn live from the grid">
              <Scene {...scene} />
            </svg>
          )}
          <p className="px-3 pb-1.5 text-center text-[10px] italic text-ink-dim">{transmissionFor(lifetimePower)}</p>
        </>
      )}
    </div>
  );
}
