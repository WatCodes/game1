/**
 * The eight ages, each with its own frame (design 4b).
 *
 * The courtyard is the home screen, so ascending has to *look* like arriving
 * somewhere new — otherwise every era is the same picture with bigger numbers.
 * Each age therefore supplies two things:
 *
 *  - `vars`: era scenery colours, applied as CSS custom properties on the world
 *    root. The altar, plinth, installations and pop-ups read the same tokens
 *    they always did, so they recolour without knowing ages exist.
 *  - `Backdrop`: sky, celestial body, horizon landmark and floor.
 *
 * What stays constant is the style: flat layered CSS shapes, one receding floor
 * plane on the same perspective, and **the cats' own architecture** — a
 * colonnade appears in every age, from marble in Athens to obsidian at the
 * black hole to fragments adrift in spacetime. That thread is what makes the
 * ladder read as one civilisation climbing rather than eight unrelated skins.
 */

type Vars = Record<string, string>;

export interface CatSkin {
  body: string;
  bodyDeep: string;
  ear: string;
  tail: string;
  eye: string;
}

export interface AgeFrame {
  vars: Vars;
  Backdrop: () => JSX.Element;
  /** Fur for the two courtyard cats. Dark ages need lighter cats or the pair
   *  disappears into the floor — the cats must always read. */
  cats?: [CatSkin, CatSkin];
}

/** The originals: a dark tabby and a tan one. */
export const DEFAULT_CATS: [CatSkin, CatSkin] = [
  { body: '#54493d', bodyDeep: '#2b241d', ear: '#443a30', tail: '#3a3229', eye: '#e9c25a' },
  { body: '#8a7458', bodyDeep: '#5c4a36', ear: '#6f5a42', tail: '#5a4a3a', eye: '#7fd0c0' },
];

/** The same two cats, lit from a cold source, for the ages after the sun. */
const NIGHT_CATS: [CatSkin, CatSkin] = [
  { body: '#9a8f7c', bodyDeep: '#5d5445', ear: '#7d715e', tail: '#6b6153', eye: '#ffd97a' },
  { body: '#c3b49a', bodyDeep: '#87795f', ear: '#a3937a', tail: '#8f8168', eye: '#8fe4d2' },
];

/* ---------- shared pieces ---------- */

/** The floor plane. Same polygon in every age — only the material changes. */
function Floor({ gradient, pattern, opacity = 0.5 }: { gradient: string; pattern?: string; opacity?: number }) {
  return (
    <>
      <div className="absolute inset-x-0 bottom-0 h-[62%]" style={{ background: gradient, clipPath: FLOOR_CLIP }} />
      {pattern && (
        <div
          className="absolute inset-x-0 bottom-0 h-[62%]"
          style={{ clipPath: FLOOR_CLIP, backgroundImage: pattern, opacity }}
        />
      )}
    </>
  );
}

const FLOOR_CLIP = 'polygon(24% 0, 76% 0, 100% 100%, 0 100%)';

/** Flagstones, as laid in Athens. */
const FLAGSTONES =
  'repeating-linear-gradient(#00000010 0 1px, transparent 1px 34px), repeating-linear-gradient(90deg, #00000010 0 1px, transparent 1px 40px)';

/** Perspective rays converging on the vanishing point behind the colonnade. */
function rays(colour: string, from = 200, span = 6): string {
  return `repeating-conic-gradient(from ${from}deg at 50% -8%, ${colour} 0 0.5deg, transparent 0.5deg ${span}deg)`;
}

/**
 * The cats' colonnade — the one shape carried into every age. Anchored to the
 * floor's back edge (bottom-[62%]); anchoring to the viewport top instead makes
 * it float in the sky.
 */
function Colonnade({
  colour,
  deep = colour,
  pediment,
  scale = 1,
  opacity = 1,
  broken = false,
}: {
  colour: string;
  deep?: string;
  pediment?: string;
  scale?: number;
  opacity?: number;
  /** Aether: the row is missing columns and adrift. */
  broken?: boolean;
}) {
  const heights = broken ? [46, 0, 56, 0, 52, 46] : [46, 52, 56, 56, 52, 46];
  return (
    <div
      className="absolute bottom-[62%] left-1/2 flex flex-col items-center"
      style={{ transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'bottom center', opacity }}
    >
      {pediment && (
        <div
          className="h-0 w-0"
          style={{ borderLeft: '60px solid transparent', borderRight: '60px solid transparent', borderBottom: `22px solid ${pediment}` }}
        />
      )}
      <div className="h-[10px] w-[104px]" style={{ background: colour }} />
      <div className="flex items-end gap-3">
        {heights.map((h, i) => (
          <span
            key={i}
            className={broken && h === 0 ? '' : 'w-[9px]'}
            style={
              h === 0
                ? { width: 9 }
                : { height: h, background: `linear-gradient(90deg, ${colour}, ${deep})` }
            }
          />
        ))}
      </div>
    </div>
  );
}

/** Deterministic star field — placed by hand so no age gets an unlucky clump. */
const STARS: [number, number, number][] = [
  [6, 8, 1.5], [14, 22, 1], [22, 5, 2], [29, 16, 1], [35, 30, 1.5], [41, 9, 1],
  [47, 24, 2], [53, 6, 1], [58, 19, 1.5], [64, 32, 1], [70, 11, 2], [76, 26, 1],
  [82, 7, 1.5], [88, 20, 1], [93, 34, 2], [97, 13, 1], [10, 38, 1], [18, 45, 1.5],
  [27, 41, 1], [44, 44, 1], [61, 42, 1.5], [73, 47, 1], [85, 40, 1], [92, 48, 1.5],
  [3, 28, 1], [67, 3, 1],
];

/**
 * The floating HUD owns the top 26.5% of the screen and the floor's back edge
 * sits at 38%, so the only sky the player ever actually sees is the ~93px strip
 * between them. Everything celestial is packed into that band; drawn any higher
 * it is simply never seen.
 */
const SKY_TOP = 27;
const SKY_SPAN = 0.22;

/** Height ÷ width of a typical phone frame, for converting % of one into % of
 *  the other when a shape has to span both axes. */
const PHONE_ASPECT = 2.16;

function Stars({ tint = '#fff', count = STARS.length, opacity = 0.9 }: { tint?: string; count?: number; opacity?: number }) {
  return (
    <>
      {STARS.slice(0, count).map(([x, y, r], i) => (
        <span
          key={i}
          className={i % 4 === 0 ? 'twinkle absolute rounded-full' : 'absolute rounded-full'}
          style={{
            left: `${x}%`,
            top: `${SKY_TOP + y * SKY_SPAN}%`,
            height: r,
            width: r,
            background: tint,
            opacity,
            animationDelay: `${(i % 7) * 0.6}s`,
          }}
        />
      ))}
    </>
  );
}

function Sky({ background }: { background: string }) {
  return <div className="absolute inset-0" style={{ background }} />;
}

/* ---------- 0 · Age of Athens ---------- */

const athens: AgeFrame = {
  vars: {
    '--sky': '#cfe4ea',
    '--stone': '#d8c79c',
    '--stone-deep': '#c7b487',
    '--marble': '#efe6cf',
    '--marble-deep': '#cdbf9d',
    '--sun': '#f4b942',
    '--scene-ink': '#6c6144',
  },
  Backdrop: () => (
    <>
      <Sky background="linear-gradient(var(--sky) 0%, var(--sky) 26%, var(--marble) 40%, #e0cb9c 100%)" />
      <div
        className="absolute right-8 top-[28%] h-11 w-11 rounded-full"
        style={{ background: 'radial-gradient(circle at 60% 40%, #fff0c4, var(--sun))', boxShadow: '0 0 40px rgba(244,185,66,.55)' }}
      />
      <div className="cloud-a absolute left-0 top-[30%] h-[15px] w-[60px] rounded-[10px] bg-white/70" />
      <div className="cloud-b absolute left-0 top-[35%] h-3 w-11 rounded-[10px] bg-white/55" />
      <Floor gradient="linear-gradient(var(--stone), var(--stone-deep))" pattern={FLAGSTONES} />
      <Colonnade colour="var(--marble)" deep="var(--marble-deep)" pediment="#e7dcc0" />
    </>
  ),
};

/* ---------- 1 · Age of Colonies ---------- */

/** Kept clear of the right rail's buttons, which start ~65px from the edge. */
const OLIVE = ['left-3', 'left-[76px]', 'right-[88px]', 'right-[140px]'];

const colonies: AgeFrame = {
  vars: {
    '--sky': '#d7e6e0',
    '--stone': '#c9a97e',
    '--stone-deep': '#b08a5f',
    '--marble': '#ece2cb',
    '--marble-deep': '#c9b391',
    '--sun': '#f6c65a',
    '--scene-ink': '#5f4c33',
  },
  Backdrop: () => (
    <>
      <Sky background="linear-gradient(var(--sky) 0%, var(--sky) 26%, #f2e6c8 40%, #e6cfa3 100%)" />
      <div
        className="absolute left-10 top-[28%] h-12 w-12 rounded-full"
        style={{ background: 'radial-gradient(circle at 60% 40%, #fff4cf, var(--sun))', boxShadow: '0 0 44px rgba(246,198,90,.5)' }}
      />
      <div className="cloud-a absolute left-0 top-[32%] h-3.5 w-16 rounded-[10px] bg-white/60" />

      {/* The sea the colonies were reached across. The top edge fades rather
          than cutting a hard line, so the sun sinks into water instead of
          being clipped by a blue rectangle. */}
      <div
        className="absolute inset-x-0 bottom-[62%] h-[52px]"
        style={{ background: 'linear-gradient(rgba(168,200,194,.35) 0%, #9cc0bc 26%, #7ba7ad 100%)' }}
      />
      <div className="absolute inset-x-0 bottom-[62%] h-[2px]" style={{ background: 'rgba(255,255,255,.5)' }} />
      <div className="sail-a absolute bottom-[calc(62%+26px)] left-0">
        <span
          className="block h-0 w-0"
          style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '11px solid #fbf6ea' }}
        />
      </div>
      <div className="sail-b absolute bottom-[calc(62%+14px)] left-0">
        <span
          className="block h-0 w-0"
          style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '9px solid #f0e6d2' }}
        />
      </div>

      <Floor
        gradient="linear-gradient(var(--stone), var(--stone-deep))"
        pattern="repeating-linear-gradient(#00000014 0 1px, transparent 1px 30px)"
        opacity={0.55}
      />

      {/* the aqueduct — the first thing the colonies built for themselves */}
      <div className="absolute bottom-[calc(62%+58px)] left-1/2 flex -translate-x-1/2 flex-col items-center">
        <div className="h-[7px] w-[148px]" style={{ background: 'var(--marble)' }} />
        <div className="flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-6 w-[29px] rounded-t-full border-4 border-b-0"
              style={{ borderColor: 'var(--marble-deep)' }}
            />
          ))}
        </div>
      </div>

      {OLIVE.map((pos, i) => (
        <div key={pos} className={`absolute bottom-[44%] ${pos}`}>
          <div
            className="h-4 w-[26px] rounded-[50%]"
            style={{ background: i % 2 ? '#71835d' : '#63764f' }}
          />
          <div className="mx-auto h-3.5 w-[4px]" style={{ background: '#6f5a42' }} />
        </div>
      ))}

      <Colonnade colour="var(--marble)" deep="var(--marble-deep)" pediment="#e7dcc0" scale={0.72} opacity={0.9} />
    </>
  ),
};

/* ---------- 2 · Age of Dominion ---------- */

const TOWERS: [string, number, number][] = [
  ['12%', 14, 30], ['22%', 10, 46], ['31%', 16, 24], ['62%', 12, 38], ['72%', 18, 28], ['84%', 11, 44],
];
/** Harbour lights running to the edge of the world. */
const HARBOUR = [4, 11, 19, 28, 38, 47, 57, 66, 75, 84, 92, 97];

const dominion: AgeFrame = {
  vars: {
    '--sky': '#6a76a4',
    '--stone': '#cbb894',
    '--stone-deep': '#a8926b',
    '--marble': '#f0e7d2',
    '--marble-deep': '#c9b28a',
    '--sun': '#f0894b',
    '--scene-ink': '#59472f',
  },
  Backdrop: () => (
    <>
      <Sky background="linear-gradient(#5b6a9e 0%, #5b6a9e 22%, #9a7f9c 31%, #d08a5c 38%, #eec89a 100%)" />
      <Stars tint="#e8ddff" count={10} opacity={0.55} />
      <div
        className="absolute right-8 top-[28%] h-6 w-6 rounded-full"
        style={{ background: '#efe6cf', opacity: 0.75, boxShadow: '0 0 18px rgba(239,230,207,.5)' }}
      />
      {/* the sun going down on the last unclaimed continent */}
      <div
        className="absolute bottom-[calc(62%-18px)] left-[22%] h-16 w-16 rounded-full"
        style={{ background: 'radial-gradient(circle, #ffd9a0, var(--sun) 62%, transparent 72%)', boxShadow: '0 0 60px rgba(240,137,75,.6)' }}
      />

      {/* skyline: every city the cats hold */}
      {TOWERS.map(([x, w, h], i) => (
        <div
          key={x}
          className="absolute bottom-[62%]"
          style={{ left: x, width: w, height: h, background: 'linear-gradient(#7a6a72, #55495a)' }}
        >
          <span
            className={i % 2 ? 'flicker absolute left-1/2 top-1.5 h-1 w-1 -translate-x-1/2 rounded-full' : 'absolute left-1/2 top-1.5 h-1 w-1 -translate-x-1/2 rounded-full'}
            style={{ background: 'var(--amber-dim)' }}
          />
        </div>
      ))}

      {/* The Pharos, sweeping. Kept out of the middle third — the colonnade
          owns the centre in every age and swallowed it whole there. */}
      <div className="absolute bottom-[62%] left-[13%]">
        <div className="h-[62px] w-3" style={{ background: 'linear-gradient(90deg, var(--marble), #9d8a76)', clipPath: 'polygon(22% 0, 78% 0, 100% 100%, 0 100%)' }} />
        <div className="glowpulse absolute -top-1 left-1/2 h-2.5 w-2.5 rounded-full" style={{ background: '#ffe9a8', boxShadow: '0 0 14px 4px rgba(255,215,130,.85)' }} />
      </div>

      {HARBOUR.map((x, i) => (
        <span
          key={x}
          className="absolute bottom-[calc(62%-3px)] h-[3px] w-[3px] rounded-full"
          style={{ left: `${x}%`, background: 'var(--amber)', opacity: i % 3 === 0 ? 0.95 : 0.6 }}
        />
      ))}

      <Floor
        gradient="linear-gradient(var(--stone), var(--stone-deep))"
        pattern={`${rays('rgba(184,137,47,.55)')}, repeating-linear-gradient(#00000010 0 1px, transparent 1px 38px)`}
        opacity={0.6}
      />
      <Colonnade colour="var(--marble)" deep="var(--marble-deep)" pediment="#f2e9d4" scale={0.85} />
    </>
  ),
};

/* ---------- 3 · Age of Ascent ---------- */

const ascent: AgeFrame = {
  cats: NIGHT_CATS,
  vars: {
    '--sky': '#222c4e',
    '--stone': '#8f95a6',
    '--stone-deep': '#6e7488',
    '--marble': '#e8e4de',
    '--marble-deep': '#b3aeae',
    '--sun': '#cfe1ff',
    '--scene-ink': '#242a3c',
  },
  Backdrop: () => (
    <>
      <Sky background="linear-gradient(#141c38 0%, #141c38 23%, #33406f 32%, #8f8fa8 38%, #cbc2b4 100%)" />
      <Stars tint="#dfe8ff" opacity={0.8} />

      {/* the ribbon: it leaves the frame, which is the point */}
      <div
        className="absolute bottom-[62%] left-1/2 w-[6px] -translate-x-1/2"
        style={{ height: '58%', background: 'linear-gradient(#e8e4de, rgba(232,228,222,.25))' }}
      />
      <div className="absolute bottom-[62%] left-1/2 h-[58%] w-[6px] -translate-x-1/2 overflow-hidden">
        <span className="climb absolute bottom-0 left-0 h-3 w-[6px] rounded-sm" style={{ background: 'var(--amber)' }} />
        <span className="climb absolute bottom-0 left-0 h-3 w-[6px] rounded-sm" style={{ background: 'var(--amber-dim)', animationDelay: '5.5s' }} />
      </div>

      {/* gantries flanking the anchor */}
      {[-1, 1].map((side) => (
        <div
          key={side}
          className="absolute bottom-[62%]"
          style={{ left: `calc(50% + ${side * 52}px)`, transform: 'translateX(-50%)' }}
        >
          <div className="h-[70px] w-[14px]" style={{ background: 'repeating-linear-gradient(#9aa0b2 0 2px, transparent 2px 9px), linear-gradient(90deg, #7d8395, #5f6478)' }} />
        </div>
      ))}

      <Floor
        gradient="linear-gradient(var(--stone), var(--stone-deep))"
        pattern={`${rays('rgba(232,228,222,.5)')}, repeating-linear-gradient(45deg, rgba(184,137,47,.45) 0 6px, transparent 6px 26px)`}
        opacity={0.3}
      />
      {/* the anchor collar keeps the temple silhouette at the elevator's foot */}
      <Colonnade colour="var(--marble)" deep="var(--marble-deep)" pediment="#efece6" scale={0.6} opacity={0.85} />
    </>
  ),
};

/* ---------- 4 · Age of Helios ---------- */

const helios: AgeFrame = {
  vars: {
    '--sky': '#3a1a08',
    '--stone': '#e6d9c0',
    '--stone-deep': '#c2ae8e',
    '--marble': '#f6e6c6',
    '--marble-deep': '#c9a978',
    '--sun': '#ffd88a',
    '--scene-ink': '#5a4326',
  },
  Backdrop: () => (
    <>
      <Sky background="linear-gradient(#26100a 0%, #26100a 21%, #7b2f0c 30%, #d1701f 37%, #f2b451 100%)" />

      {/* the sun, close enough to build on */}
      <div
        className="absolute bottom-[calc(62%-150px)] left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle at 50% 40%, #fffaf0 0%, #ffd88a 32%, #f59a2a 62%, rgba(245,154,42,0) 74%)' }}
      />

      {/* the swarm, still going up */}
      {[
        { rx: 186, ry: 40, dash: undefined, colour: 'rgba(255,244,214,.95)', w: 2.5 },
        { rx: 232, ry: 52, dash: '22 10', colour: 'rgba(255,232,180,.8)', w: 2 },
        { rx: 280, ry: 66, dash: '8 14', colour: 'rgba(255,224,160,.6)', w: 2 },
      ].map((r, i) => (
        <span
          key={i}
          className="spin-slow absolute bottom-[calc(62%-10px)] left-1/2 rounded-[50%]"
          style={{
            width: r.rx,
            height: r.ry,
            marginLeft: -r.rx / 2,
            marginBottom: -r.ry / 2,
            border: `${r.w}px ${r.dash ? 'dashed' : 'solid'} transparent`,
            borderColor: r.colour,
            borderStyle: r.dash ? 'dashed' : 'solid',
            animationDuration: `${60 + i * 26}s`,
          }}
        />
      ))}

      <Floor
        gradient="linear-gradient(var(--stone), var(--stone-deep))"
        pattern={`${rays('rgba(184,137,47,.5)')}, repeating-linear-gradient(#00000012 0 1px, transparent 1px 30px)`}
        opacity={0.5}
      />
      {/* silhouetted against the star — the best the colonnade has ever looked */}
      <Colonnade colour="rgba(58,26,8,.82)" pediment="rgba(58,26,8,.82)" scale={0.95} />
    </>
  ),
};

/* ---------- 5 · Age of Erebus ---------- */

const erebus: AgeFrame = {
  cats: NIGHT_CATS,
  vars: {
    '--sky': '#0b0913',
    '--stone': '#221d30',
    '--stone-deep': '#151220',
    '--marble': '#3d3554',
    '--marble-deep': '#251f36',
    '--sun': '#c9a2f2',
    '--scene-ink': '#cbbb96',
  },
  Backdrop: () => (
    <>
      <Sky background="linear-gradient(#07060e 0%, #07060e 25%, #171029 34%, #2b1f42 100%)" />
      <Stars tint="#e6ddff" opacity={0.75} />

      {/* accretion disc, seen almost edge-on */}
      <span
        className="spin-slow absolute bottom-[calc(62%+30px)] left-1/2 rounded-[50%]"
        style={{
          width: 210, height: 54, marginLeft: -105, marginBottom: -27,
          border: '3px solid rgba(255,196,120,.9)',
          boxShadow: '0 0 26px rgba(255,170,80,.55), inset 0 0 18px rgba(255,150,60,.5)',
          animationDuration: '26s',
        }}
      />
      {/* the light that fell in and came back over the top */}
      <span
        className="absolute bottom-[calc(62%+54px)] left-1/2 h-[54px] w-[132px] -translate-x-1/2 rounded-t-full"
        style={{ border: '2px solid rgba(201,162,242,.6)', borderBottom: 'none' }}
      />
      {/* the hole itself */}
      <span
        className="absolute bottom-[calc(62%+30px)] left-1/2 h-[54px] w-[54px] -translate-x-1/2 translate-y-1/2 rounded-full"
        style={{ background: '#050409', boxShadow: '0 0 0 2px rgba(255,214,150,.7), 0 0 34px 6px rgba(120,80,200,.35)' }}
      />

      <Floor
        gradient="linear-gradient(var(--stone), var(--stone-deep))"
        pattern={`${rays('rgba(201,162,242,.45)')}, repeating-linear-gradient(rgba(184,137,47,.28) 0 1px, transparent 1px 34px)`}
        opacity={0.6}
      />
      <Colonnade colour="var(--marble)" deep="var(--marble-deep)" pediment="#4a4066" scale={0.68} />
    </>
  ),
};

/* ---------- 6 · Age of Constellations ---------- */

/**
 * A constellation of held systems, in the right half of the sky band. Both
 * coordinates are viewport percentages, and they must stay above the horizon
 * (38%) — placed lower they sit *on the courtyard floor* like dropped marbles.
 */
const CLUSTER: [number, number][] = [[63, 31], [71, 35], [79, 29], [87, 34], [94, 30]];

const constellations: AgeFrame = {
  cats: NIGHT_CATS,
  vars: {
    '--sky': '#070a18',
    '--stone': 'rgba(24,38,74,.86)',
    '--stone-deep': 'rgba(12,20,44,.92)',
    '--marble': '#dfe6f2',
    '--marble-deep': '#94a6c6',
    '--sun': '#a9c6ff',
    '--scene-ink': '#cfd8ea',
  },
  Backdrop: () => (
    <>
      <Sky background="linear-gradient(#050818 0%, #050818 25%, #101a3a 34%, #1d2d5c 100%)" />
      <Stars tint="#ffffff" opacity={0.85} />

      {/* The galaxy, turning. Off to one side: centred, the colonnade covers it
          completely and all you get is a faint halo behind the columns. */}
      <div className="spin-slow absolute left-[24%] top-[32%] h-[130px] w-[130px] -translate-x-1/2 -translate-y-1/2" style={{ animationDuration: '90s' }}>
        <span
          className="absolute inset-0 rounded-[50%]"
          style={{ background: 'radial-gradient(ellipse 46% 16% at 50% 50%, rgba(255,255,255,.95), rgba(169,198,255,.55) 32%, rgba(124,92,191,.22) 58%, transparent 72%)' }}
        />
        <span
          className="absolute inset-0 rounded-[50%]"
          style={{ transform: 'rotate(58deg)', background: 'radial-gradient(ellipse 44% 13% at 50% 50%, rgba(169,198,255,.5), transparent 66%)' }}
        />
      </div>

      {/* Systems on the grid, wired together. The link angles are computed from
          the real node positions rather than eyeballed, so the constellation
          stays joined up at any viewport size. */}
      {CLUSTER.slice(0, -1).map(([x, y], i) => {
        const [nx, ny] = CLUSTER[i + 1];
        // A percent of height covers ~2.2× the pixels of a percent of width on a
        // phone, so the vertical delta is converted into width units before the
        // length and angle mean anything. Sibling of the dots, not a child —
        // a percentage width has to resolve against the backdrop, not the dot.
        const dy = (ny - y) * PHONE_ASPECT;
        return (
          <span
            key={`link-${x}`}
            className="shimmer absolute h-px origin-left"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${Math.hypot(nx - x, dy)}%`,
              background: 'linear-gradient(90deg, rgba(169,198,255,.85), rgba(169,198,255,.2))',
              transform: `translate(3px, 3px) rotate(${(Math.atan2(dy, nx - x) * 180) / Math.PI}deg)`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        );
      })}
      {CLUSTER.map(([x, y]) => (
        <span
          key={x}
          className="absolute h-1.5 w-1.5 rounded-full"
          style={{ left: `${x}%`, top: `${y}%`, background: 'var(--sun)', boxShadow: '0 0 8px rgba(169,198,255,.9)' }}
        />
      ))}

      <Floor
        gradient="linear-gradient(var(--stone), var(--stone-deep))"
        pattern={`${rays('rgba(169,198,255,.5)')}, repeating-linear-gradient(rgba(169,198,255,.32) 0 1px, transparent 1px 30px)`}
        opacity={0.75}
      />
      <Colonnade colour="var(--marble)" deep="var(--marble-deep)" pediment="#eaf0fa" scale={0.9} opacity={0.92} />
    </>
  ),
};

/* ---------- 7 · Age of Aether ---------- */

const MOTES = [
  'left-[18%] top-[30%]', 'left-[34%] top-[28%]', 'left-[68%] top-[29%]',
  'left-[82%] top-[35%]', 'left-[12%] top-[36%]', 'left-[56%] top-[27%]',
];

const aether: AgeFrame = {
  vars: {
    '--sky': '#f1ecfa',
    '--stone': 'rgba(255,255,255,.62)',
    // Opaque enough that the altar plinth and the installations still have an
    // edge — at .25 everything dissolved into the same pale lavender.
    '--stone-deep': 'rgba(184,170,218,.6)',
    '--marble': '#fbf8ff',
    '--marble-deep': '#d5cbe8',
    '--sun': '#e7d8ff',
    '--scene-ink': '#5b4f78',
  },
  Backdrop: () => (
    <>
      <Sky background="linear-gradient(#f6f2fc 0%, #f6f2fc 25%, #e9e2f6 34%, #ddd4ee 100%)" />

      {/* spacetime, and the fact that it bends */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background: `${rays('rgba(124,92,191,.28)', 200, 7)}, repeating-linear-gradient(rgba(124,92,191,.16) 0 1px, transparent 1px 26px)`,
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 46%, #000 30%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 46%, #000 30%, transparent 78%)',
        }}
      />
      <div
        className="glowpulse absolute left-1/2 top-[32%] h-[120px] w-[120px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,.9), rgba(231,216,255,.4) 46%, transparent 70%)' }}
      />

      {MOTES.map((pos, i) => (
        <span
          key={pos}
          className={`floaty absolute ${pos} block rounded-sm`}
          style={{
            height: 6 + (i % 3) * 3,
            width: 10 + (i % 4) * 5,
            background: 'linear-gradient(120deg, #fbf8ff, #d5cbe8)',
            transform: `rotate(${(i % 2 ? 1 : -1) * (8 + i * 4)}deg)`,
            animationDelay: `${i * 0.7}s`,
            boxShadow: '0 4px 12px rgba(124,92,191,.18)',
          }}
        />
      ))}

      <Floor
        gradient="linear-gradient(rgba(255,255,255,.55), rgba(214,203,236,0))"
        pattern={`${rays('rgba(124,92,191,.35)')}, repeating-linear-gradient(rgba(124,92,191,.18) 0 1px, transparent 1px 28px)`}
        opacity={0.8}
      />
      {/* the colonnade finally comes apart — and keeps standing anyway */}
      <Colonnade colour="var(--marble)" deep="var(--marble-deep)" pediment="#fbf8ff" scale={0.95} broken />
    </>
  ),
};

const FRAMES: AgeFrame[] = [athens, colonies, dominion, ascent, helios, erebus, constellations, aether];

/** Tiers past the authored eight repeat Aether — the procedural prestige tail. */
export function frameForTier(tier: number): AgeFrame {
  return FRAMES[Math.min(Math.max(tier, 0), FRAMES.length - 1)];
}

export const AGE_COUNT = FRAMES.length;

/**
 * Dev: `?age=5` pins the backdrop to one era. An art pass on the Aether frame
 * otherwise costs seven ascensions to look at. Scenery only — no game state is
 * touched, and it is ignored in production builds.
 */
export function devAgeOverride(): number | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('age');
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
