# BUILD_PLAN.md — Kardashev

Build in order. **`/clear` between milestones** — each is a clean session that rebuilds
context cheaply from `CLAUDE.md` + `/docs`. The **Model** column encodes the usage policy:
plan hard parts on Fable, execute on Sonnet, do mechanical work on Haiku.

How to read the model calls:
- **Fable (plan)** = `/model fable`, work in plan mode (Shift+Tab twice), then `/model sonnet`
  to execute the plan. Or use `/model opusplan` to auto-plan-then-execute if you'd rather not
  spend Fable on execution.
- Start each milestone by pasting: *"Read CLAUDE.md and docs/, then implement milestone Mx per
  docs/BUILD_PLAN.md. Plan the files you'll touch before writing code."*

---

## M0 — Scaffold
**Model:** Haiku (config) + Sonnet (wiring) · **~small**

- [ ] `npm create vite@latest` (React + TS), add Tailwind, Zustand, Vitest.
- [ ] Create the folder structure from `ARCHITECTURE.md §3`. Stub empty modules.
- [ ] Add `tsconfig` strict, `.claudeignore` (`node_modules`, `dist`, `coverage`, lockfiles),
      npm scripts (`dev/build/preview/test/typecheck/lint`).
- [ ] `tokens.css` with the control-room palette from `GAME_DESIGN §7`. Blank app shell.

**Done when:** `npm run dev` serves an empty themed shell; `npm run typecheck` passes.
**`/clear`.**

---

## M1 — Core economy loop  ← the heart; get this feeling good
**Model:** Fable (plan engine + formulas) → Sonnet (UI) · **~large**

- [ ] `types.ts`, `state.ts` (initial T0 state), `content/config.ts`, `content/sources.ts` (T0 sources).
- [ ] `formulas.ts`: `sourceCost`, `buyMaxCount`, `sourceMilestoneMult`, `globalMilestoneMult`,
      `powerPerSec` (correct multiplier order per `ARCHITECTURE §7`). **Unit tests first.**
- [ ] `economy.ts`: `buy(sourceId, count)`, milestone application.
- [ ] `loop.ts` `tick()`, `store/gameStore.ts` with throttled `display` slice,
      `useGameTick.ts`.
- [ ] UI: `PowerMeter`, `ResourceBar`, `SourceRow` (buy 1/10/max, "N to ×2" hint), `SourcesPanel`.

**Done when:** you can buy sources, power ticks smoothly, count-milestones double output,
"buy max" is correct, `formulas`/`economy` tests green. This should already be *fun*.
**`/clear`.**

---

## M2 — Research
**Model:** Fable (plan effect resolution) → Sonnet (impl) + Haiku (node data) · **~medium**

- [ ] `content/research.ts` (T0/T1 nodes), RP generation in `tick()`.
- [ ] `research.ts`: `buyResearch(id)`, `applyEffect(effect)` for every `ResearchEffect` kind,
      prereq gating.
- [ ] UI: `ResearchTree` + `ResearchNode` (locked/available/purchased states), RP in ResourceBar.
- [ ] Wire effects into `powerPerSec` / rp rate / offline cap / automation.

**Done when:** RP accrues, nodes gate on prereqs, purchasing changes the economy live.
**`/clear`.**

---

## M3 — Megaprojects
**Model:** Fable (plan commit/stage math) → Sonnet (impl + UI) · **~medium**

- [ ] `content/megaprojects.ts` (T0 project), `megaproject.ts`: `commitPower`, `routePct`
      auto-divert in `tick()`, stage advancement + stage rewards, completion.
- [ ] UI: `MegaprojectPanel` — progress + stages that visibly light up, a route-% slider,
      commit button. This is the spectacle; give it the second-most polish after the meter.

**Done when:** routing/committing power fills the bar, stages pay out, completion flags the
project done and unlocks Ascend. **`/clear`.**

---

## M4 — Ascension  ← the meta-loop
**Model:** Fable (plan reset/keep + KP math — high-risk logic) → Sonnet (impl) · **~medium**

- [ ] `content/tiers.ts` (all tiers + era copy + scale copy), sources/research/megaproject for
      **T1–T2** so there's somewhere to ascend into.
- [ ] `ascension.ts`: `canAscend`, projected KP, `ascend()` (reset sources/power/runPower/
      megaproject; **keep** KP + research; `tier++`; swap in new content), `prestigeMult` into
      `powerPerSec`.
- [ ] UI: `AscendPanel` with projected KP and a confirm; ascension toast + number-jump.

**Done when:** completing the megaproject lets you ascend, KP banks and multiplies everything,
the tier advances with new sources and new scale copy, and re-climbing is visibly faster.
**Unit-test the reset/keep split.** **`/clear`.**

---

## M5 — Persistence & offline
**Model:** Fable (plan save schema + migration + offline math) → Sonnet (impl) · **~medium**

- [ ] `store/save.ts`: versioned serialize/deserialize (runtime state only, rehydrate content),
      autosave (interval + `visibilitychange`/`beforeunload`), a `migrate()` stub with one
      example migration.
- [ ] `offline.ts`: `creditOffline` with cap clamp; "while you were away" summary on load.
- [ ] Export/import (base64) with validation.

**Done when:** reload restores exact state, offline credits correctly (and never double), a
mangled import is rejected cleanly. **`save`/`offline` tests green.** **`/clear`.**

---

## M6 — Juice, UX, mobile, PWA
**Model:** Haiku (CSS/copy) + Sonnet (interactions) · **~medium**

- [ ] Toasts for milestones/research/stages/ascension; number-roll on big jumps;
      `prefers-reduced-motion`.
- [ ] Tabs (Sources / Research / Megaproject / Ascend), bottom action bar, responsive to ~380px.
- [ ] Keyboard focus + a11y pass. Optional: `Dispatch` button (`GAME_DESIGN §3.7`), audio.
- [ ] `vite-plugin-pwa` → installable + offline.

**Done when:** it's satisfying on a phone, animations respect reduced-motion, installs as a PWA.
**`/clear`.**

---

## M7 — Balance pass  ← do this by hand / on Haiku, not Fable
**Model:** manual playtest + Haiku (edit `content/**`) · **~small, iterative**

- [ ] Playtest against the pacing targets in `GAME_DESIGN §5` (first milestone ~1 min, first
      megaproject ~8–12 min, first ascension right after).
- [ ] Tune constants in `content/config.ts` + per-source costs/outputs. **Only touch data.**
- [ ] Fill in T3–T8 content (Dyson Swarm/Sphere, Stellar Engine, Galactic Web, Vacuum Kernel,
      procedural tail). This is mostly Haiku-friendly data entry from `GAME_DESIGN §4`.
- [ ] Check no dead ends (always an affordable next purchase) and that KP keeps re-climbs fast.

**Done when:** the curve feels good end-to-end and the whole Kardashev ladder is populated.

---

## Milestone → model cheat sheet

| Milestone | Where Fable earns its cost | Bulk on Sonnet | Haiku |
|---|---|---|---|
| M0 Scaffold | — | wiring | config, tokens |
| M1 Economy | formulas + powerPerSec ordering | store, loop, UI | — |
| M2 Research | effect-resolution design | impl, UI | node data |
| M3 Megaprojects | commit/stage math | panel, slider | — |
| M4 Ascension | reset/keep + KP formula | UI, wiring | — |
| M5 Save/Offline | schema, migration, offline math | impl | — |
| M6 Juice/PWA | — | interactions | CSS, copy |
| M7 Balance | (only if reasoning about the curve) | — | content edits |

**Rule:** if the task is "decide how it should work / get the math right," that's a Fable
plan. If it's "type out what we decided," that's Sonnet or Haiku. Escalation is a choice you
make deliberately, not a default you leave on.
