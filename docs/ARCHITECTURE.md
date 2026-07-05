# ARCHITECTURE.md — Kardashev

How the code is organized and *why*. The central constraint of any idle game drives all of
this: **a fast game loop must update big numbers many times per second without melting React.**

---

## 1. Stack rationale

- **Vite + React + TypeScript** — fast HMR, typed content/formulas (the risk surface),
  trivial static deploy.
- **Zustand** over Redux/Context — minimal boilerplate, and crucially it lets React
  components subscribe to *narrow slices* so we can isolate the fast-ticking numbers from the
  rest of the UI. Context would re-render the world every frame; we won't use it for game state.
- **Tailwind + a token layer** — speed, with `tokens.css` holding the palette so the
  control-room aesthetic stays consistent and swappable.
- **Vitest** — same transform pipeline as Vite; we unit-test the engine, not the UI.
- **localStorage** — this is a real web app (not a sandboxed artifact), so browser storage is
  available and correct here. Saves are versioned JSON.
- **No big-number lib yet.** MVP tops out near ~1e40, comfortably inside JS `number`
  (max ~1.8e308). We hide quantities behind a `Num` alias so switching to `break_infinity.js`
  later (only if a deep-prestige tail needs it) is a localized change, not a rewrite.

---

## 2. The core pattern: engine ↔ loop ↔ store ↔ UI

```
        ┌─────────────────────────── pure TypeScript, no React/DOM ──────────────────────────┐
        │  engine/                                                                            │
        │    state.ts       GameState (the authoritative mutable object)                      │
        │    economy.ts     buy(), powerPerSec(), milestone math                              │
        │    research.ts    RP gen, applyEffect()                                             │
        │    megaproject.ts commit(), advanceStages()                                         │
        │    ascension.ts   canAscend(), ascend()                                             │
        │    offline.ts     creditOffline()                                                   │
        │    formulas.ts    pure math (cost, milestones, kp) — 100% unit-tested               │
        │    format.ts      formatPower()                                                      │
        │    loop.ts        tick(state, dt): mutate state forward by dt seconds                │
        └────────────────────────────────────────────────────────────────────────────────────┘
                       ▲ actions call engine fns          │ loop mutates state
                       │                                   ▼
        ┌───────────── store/gameStore.ts (Zustand) ───────────────────────────────┐
        │  • holds the GameState                                                    │
        │  • exposes actions (buySource, buyResearch, commitPower, ascend, …)       │
        │  • runs the fixed-timestep loop via useGameTick()                         │
        │  • publishes a THROTTLED `display` slice (~10–15 Hz) for number readouts  │
        └──────────────────────────────────────────────────────────────────────────┘
                       ▲ selectors                         │ throttled snapshot
                       │                                   ▼
        ┌───────────── ui/ (React) ────────────────────────────────────────────────┐
        │  PowerMeter subscribes to display.power / display.pps only                │
        │  SourceRow subscribes to its own source slice + a buy action              │
        │  ResearchTree / MegaprojectPanel / AscendPanel subscribe to their slices  │
        └──────────────────────────────────────────────────────────────────────────┘
```

**Why throttled display:** the loop advances `power` every animation frame, but humans can't
read 60 updates/sec. The store keeps the *authoritative* `power` updating continuously, and
separately writes a `display` object (rounded/snapshotted) at ~12 Hz. Only the `display` slice
drives React renders. Result: smooth-looking numbers, tiny render load. Interactions
(buy/research) act on the authoritative state immediately and force a display refresh.

### Fixed-timestep loop (`ui/hooks/useGameTick.ts` + `engine/loop.ts`)

```ts
// engine/loop.ts — pure, no React
export function tick(s: GameState, dt: number): void {
  const pps = powerPerSec(s);
  s.power += pps * dt;
  s.runPower += pps * dt;
  s.rp += researchRate(s) * dt;
  advanceMegaproject(s, dt);   // if auto-routing % of income
  // milestones/derived values are computed on read, not stored
}
```

```ts
// ui/hooks/useGameTick.ts — drives the loop, publishes throttled display
useEffect(() => {
  let raf = 0, last = performance.now(), acc = 0, disp = 0;
  const STEP = 1 / 20;                 // 20 Hz simulation
  const frame = (now: number) => {
    let dt = (now - last) / 1000; last = now;
    dt = Math.min(dt, 0.25);           // clamp after tab-away; offline handles long gaps
    acc += dt;
    while (acc >= STEP) { tick(state, STEP); acc -= STEP; }
    disp += dt;
    if (disp >= 1 / 12) { publishDisplay(state); disp = 0; }  // ~12 Hz to React
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}, []);
```

Fixed-timestep keeps simulation deterministic and testable; the display cadence is separate.

---

## 3. Folder structure

```
kardashev-grid/
  CLAUDE.md
  docs/  GAME_DESIGN.md  ARCHITECTURE.md  BUILD_PLAN.md
  .claudeignore
  index.html
  package.json  tsconfig.json  vite.config.ts  tailwind.config.ts
  src/
    engine/          # pure TS, unit-tested, NO react/DOM/window
      types.ts
      state.ts
      formulas.ts
      economy.ts
      research.ts
      megaproject.ts
      ascension.ts
      offline.ts
      format.ts
      loop.ts
    content/         # DATA ONLY — balancing lives here
      config.ts      # the constants block from GAME_DESIGN §5
      tiers.ts
      sources.ts
      research.ts
      megaprojects.ts
    store/
      gameStore.ts   # Zustand: state + actions + display slice
      save.ts        # serialize, migrate, load, export/import
    ui/
      hooks/useGameTick.ts
      theme/tokens.css
      components/
        PowerMeter.tsx
        ResourceBar.tsx
        SourceRow.tsx  SourcesPanel.tsx
        ResearchTree.tsx  ResearchNode.tsx
        MegaprojectPanel.tsx
        AscendPanel.tsx
        Toasts.tsx
        Tabs.tsx
      App.tsx
    main.tsx
  tests/
    formulas.test.ts  economy.test.ts  ascension.test.ts  offline.test.ts  save.test.ts
```

---

## 4. Data models (`engine/types.ts`)

```ts
export type Num = number;               // swap-point for break_infinity.js later
export type Id = string;

export interface PowerSource {
  id: Id; name: string; tier: number;
  baseCost: Num; costGrowth: number; baseOutput: Num;  // W/s per unit
  owned: number;
  unlockedBy?: Id | { tier: number };   // research id or tier gate
  automated?: boolean;                   // manager purchased
}

export type ResearchEffect =
  | { kind: 'unlockSource'; sourceId: Id }
  | { kind: 'multSource'; sourceId: Id; x: number }
  | { kind: 'multGlobal'; x: number }
  | { kind: 'multRpRate'; x: number }
  | { kind: 'reduceMegaprojectCost'; x: number }   // 0..1
  | { kind: 'increaseOfflineCap'; seconds: number }
  | { kind: 'unlockAutomation'; sourceId: Id };

export interface ResearchNode {
  id: Id; name: string; desc: string; tier: number;
  cost: Num;               // RP
  prereqs: Id[];
  effect: ResearchEffect;
  purchased?: boolean;
}

export interface MegaprojectStage { reward: number /* mult */; label: string; }
export interface Megaproject {
  id: Id; name: string; tier: number;
  totalCost: Num;          // Power to complete
  stages: MegaprojectStage[];
  rpCost?: Num;
  completionReward: number; // one-time global mult on completion
  committed: Num;          // runtime progress
}

export interface KardashevTier {
  index: number; era: string; scaleCopy: string;
  baseCostMult: number;    // scales source costs at this tier
  kardashevLabel?: string; // "Type I" etc.
}

export interface GameState {
  version: number;
  tier: number;
  power: Num; runPower: Num;      // runPower drives global milestones, resets on ascend
  rp: Num;
  kp: number;                     // Kardashev Points (permanent)
  sources: Record<Id, PowerSource>;
  research: Record<Id, ResearchNode>;
  megaproject: Megaproject;       // current tier's project
  routePct: number;               // % of income diverted to megaproject (0..1)
  offlineCapSeconds: number;
  dispatchReadyAt: number;        // epoch ms
  lastSaved: number;              // epoch ms
  stats: { lifetimePower: Num; ascensions: number; startedAt: number };
}
```

Derived values (powerPerSec, milestone counts, next-milestone, projected KP) are **computed
functions**, never stored — this prevents save/load drift and makes them unit-testable.

---

## 5. Save system (`store/save.ts`)

- **Serialize** `GameState` → JSON in `localStorage` under a versioned key (`kardashev:v1`).
- **`version`** field on state; a `migrate(old): GameState` chain upgrades old saves. Never
  break a save silently — migrate or clearly reset with a notice.
- **Autosave** every 5–10s and on significant actions (buy-max, research, ascend) and on
  `visibilitychange`/`beforeunload`.
- **Offline:** on load, run `creditOffline(state, now)` before the first render.
- **Export/Import:** base64-encode the JSON for a copy-paste backup string (a nice cheap
  feature; ship in M5). Validate on import; reject malformed with a clear message.
- Content (sources/research definitions) is **rehydrated from `content/**`, not stored** —
  saves only persist runtime state (owned counts, purchased flags, progress, resources). This
  keeps saves small and lets you rebalance content without invalidating saves.

---

## 6. Testing (`tests/`, Vitest)

Test the **engine**, not the UI. Priority order:

1. `formulas.test.ts` — cost curve, buy-max solver, source & global milestones, KP gain,
   offline credit, number formatting boundaries (999→1.00 kW, YW→scientific).
2. `economy.test.ts` — buying deducts correctly, milestones flip output, powerPerSec composes
   all multipliers in the right order.
3. `ascension.test.ts` — canAscend gating, reset-vs-keep correctness (KP & research survive,
   sources & runPower reset), tier advance.
4. `offline.test.ts` — cap clamping, correct credit, no double-credit.
5. `save.test.ts` — round-trip serialize/deserialize, a v0→v1 migration, import validation.

Rule of thumb: **if a bug here would silently corrupt the player's numbers, it needs a test.**

---

## 7. Performance & correctness notes

- Multiplier order is fixed and documented in `powerPerSec` (source mults → global milestone →
  era → prestige → research global). Keep it consistent or numbers drift.
- Clamp per-frame `dt` (≤0.25s) so a backgrounded tab doesn't inject a huge jump — long gaps
  are the offline system's job, not the live loop's.
- `SourceRow` renders are the main list cost: subscribe each row to only its own source slice
  and memoize; don't re-render the whole list when one source changes.
- Consider `vite-plugin-pwa` in M6 to make it installable and truly offline-capable — fitting
  for an idle game.

---

## 8. Deploy

`npm run build` → static `dist/`. Deploy to Netlify / Vercel / GitHub Pages / Cloudflare
Pages (any static host). No backend in v1.
