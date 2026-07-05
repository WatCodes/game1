# CLAUDE.md — Kardashev (working title)

> Keep this file lean. It is injected into **every** Claude Code request, so it is a
> per-turn token tax. Conventions and decisions only — not tutorials. Deep detail
> lives in `/docs`. Target: under ~180 lines.

## What we're building

An **incremental / idle power-empire game** that climbs the **Kardashev scale** — from a
single home circuit (kW) to universe-scale power (10³⁶ W and beyond). Runs in the browser.

**Core loop:** grow a power economy → spend Research Points on a tech tree → construct a
signature **megaproject** to gate each tier → **ascend** the Kardashev scale, resetting your
buildout but banking permanent multipliers, then do it all bigger.

Full design in `docs/GAME_DESIGN.md`. Architecture in `docs/ARCHITECTURE.md`.
Build order in `docs/BUILD_PLAN.md`. **Read the relevant doc before implementing a system.**

## Stack

- **Vite + React 18 + TypeScript** (strict mode on)
- **Zustand** for state (single store, wraps a pure-TS engine — see architecture)
- **Tailwind** for styling, on top of a small design-token layer (`src/ui/theme/tokens.css`)
- **Vitest** for unit tests (engine + formulas are the tested surface)
- **localStorage** for saves (versioned schema + migrations)
- Node **20+**. Windows-friendly; all commands run in PowerShell or any terminal.

## Non-negotiable architecture rules

1. **The engine is framework-agnostic pure TypeScript** (`src/engine/**`). No React, no DOM,
   no `window` inside the engine. It must be unit-testable in isolation.
2. **All balancing lives in `src/content/**` as data**, never hardcoded in logic. Tuning the
   game = editing data files. If you find yourself typing a magic number in a system file,
   it belongs in content.
3. **The game loop is fixed-timestep and decoupled from React.** The loop mutates engine
   state; React reads a *throttled* display snapshot. Never trigger a React re-render per
   frame. (Pattern in `docs/ARCHITECTURE.md`.)
4. **Numbers go behind a `Num` type alias** (`= number` for now). Do not scatter raw
   `number` for game quantities — this keeps a future swap to `break_infinity.js` local.
5. **Every formula is a pure function in `src/engine/formulas.ts`** and has a unit test.

## Commands

```bash
npm install
npm run dev        # local dev server
npm run build      # production build → dist/
npm run preview    # serve the production build
npm run test       # vitest (watch: npm run test -- --watch)
npm run typecheck  # tsc --noEmit
npm run lint
```

## Conventions

- Files/dirs: `kebab-case`. Types/components: `PascalCase`. Functions/vars: `camelCase`.
- Content records get stable string `id`s. **Never** reorder-index content by array position.
- Prefer many small pure functions over big stateful methods.
- Comments explain *why* (balancing intent, edge cases), not *what*.
- Commit per milestone (`M1: core economy loop`), not per file.

## Definition of done (per system)

Types defined → content data in place → pure logic + unit tests green → store actions wired
→ UI reads throttled slice → manual playtest → `npm run typecheck` and `npm run test` clean.

---

## Model & usage policy  ← read before choosing `/model`

This project is built to be **cheap to build**. Match the model to the task; escalate only
where reasoning actually pays off. Rough per-token cost climbs Haiku → Sonnet → Opus → Fable.

**Use Fable 5** (frontier) for **design and architecture only**: system design, the economy
/ ascension / offline math, the save schema and migrations, and any cross-cutting decision.
The cleanest way to spend Fable here is **plan mode**: `/model fable`, plan the system, then
drop to Sonnet to execute. (`/model opusplan` automates the same idea with Opus as planner if
you'd rather not burn Fable on execution.) *Requires Claude Code v2.1.170+ for Fable.*

**Use Sonnet 5** (default) for the bulk of implementation: components, store wiring, standard
system code, refactors. This is ~80% of the work and where you should live.

**Use Haiku 4.5** for mechanical, high-volume work: content-data tables (`src/content/**`),
Tailwind/CSS, copy and tooltip text, test scaffolding, renames, formatting. ~3× cheaper.

**Task → model quick map**

| Task | Model |
|---|---|
| Architecture, data-model design, formulas, ascension/offline/save logic | Fable (plan) → Sonnet (exec) |
| Feature implementation, wiring, UI components, debugging | Sonnet 5 |
| Content tables, CSS/Tailwind, copy, test boilerplate, renames | Haiku 4.5 |

**Usage hygiene (the real savings are here, not just model choice):**

- **`/clear` at every phase boundary.** The single biggest cost lever — the loop resends the
  whole history each turn. Start each milestone in `docs/BUILD_PLAN.md` fresh. This file and
  `/docs` survive `/clear`, so context is cheap to rebuild.
- **Plan before multi-file changes.** Shift+Tab twice (plan mode), or ask it to list the
  files it'll touch and what it'll do, correct in plain English, then execute.
- **`/compact` at ~80% context** if a session must run long.
- **Keep this file short** — it's taxed every turn. Push detail to `/docs`.
- **`.claudeignore`** excludes `node_modules`, `dist`, coverage, lockfiles.
- **Check `/cost` (API) or `/stats` (Pro/Max)** when a session feels heavy; spikes are almost
  always an un-`/clear`ed long session.
- **Balancing = editing `src/content/**`.** Do tuning passes by hand or on Haiku, not Fable.
- Prompt caching is on by default — don't disable it.

## Guardrails

- Don't add libraries without noting why in the relevant doc. Keep deps minimal.
- Don't touch `dist/`, `node_modules/`, or generated files.
- Don't refactor across systems mid-milestone; finish the milestone first.
- If a design question isn't answered in `/docs`, **ask** — don't invent core mechanics.
