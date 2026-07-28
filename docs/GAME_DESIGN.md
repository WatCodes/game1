# GAME_DESIGN.md — Kardashev

The complete design. Content tables here are the **source of truth**; when you implement
`src/content/**`, transcribe these values (they're starting points — tuning happens in M7).

---

## 1. Vision & pillars

You are civilization's power authority. You start with one household on a home circuit and
end by tapping the vacuum of space. The fantasy is **scale** — watching the number and the
world it powers grow by ~40 orders of magnitude.

**Design pillars**

1. **Numbers go up, mapped to real units.** Power is displayed in real SI units
   (W → kW → MW → GW → TW → PW → EW → ZW → YW → scientific). The unit climbing *is* the reward.
2. **An economy with decisions, not idle mush.** Research choices and build order matter.
   The player's four reference games (AdVenture Capitalist, Egg Inc, Soda Dungeon, Game Dev
   Tycoon) are all economy/tycoon games — this is that lineage, not a tile game.
3. **Ascension is the meta-loop.** Each Kardashev tier is a prestige: reset buildout, keep
   permanent multipliers, unlock new physics, and graduate to a bigger slice of the universe.
4. **Megaprojects are the gate and the spectacle.** You construct a signature megastructure
   to unlock each ascension — the build is the "run," the payoff is the tier jump.
5. **Balanced active/idle.** Active bursts (buy, research, advance a megaproject, dispatch)
   then it hums on its own (idle generation + offline earnings). No mandatory babysitting.

**DNA map** (what each reference game contributes):

- **AdVenture Capitalist** → the power-source list: unlock → buy stacks → count-milestones
  that double a source's output → managers automate buying.
- **Game Dev Tycoon** → research: a tech tree where *you choose* what to invest in.
- **Soda Dungeon** → megaprojects: commit resources, watch it build stage by stage, get paid.
- **Egg Inc** → ascension: prestige for permanent Kardashev Points and a bigger fantasy.

---

## 2. Resources

| Resource | Symbol | Role | Source |
|---|---|---|---|
| **Power** | W | Main currency + the score. Spent on sources, research feeds off it, megaprojects consume it. | Power sources (W/s) |
| **Research Points** | RP | Spent in the tech tree + megaproject stage authorizations. | Trickle: `researchRate` per second (from labs/upgrades) |
| **Kardashev Points** | KP | Permanent global multiplier. | Ascension |
| **Credits** | CR | Meta-economy for the shop (§3.9). Persists through ascension, like KP. Never gates progression. | Circuit puzzles (§3.8) + daily streak bonus |

Megaprojects consume **Power** (no separate construction resource) to stay lean.
Do not add resources without updating this doc.

---

## 3. Systems

### 3.1 Economy (`engine/economy.ts`, content in `content/sources.ts`)

Each **power source** is a buyable generator.

- Fields: `id`, `name`, `tier`, `baseCost`, `costGrowth`, `baseOutput` (W/s), `owned`,
  `unlockedBy` (research id or tier), plus computed multipliers.
- **Cost of the next unit:** `baseCost * costGrowth^owned` (`costGrowth` ≈ 1.12–1.15).
- **Buy 1 / Buy 10 / Buy Max.** Buy Max solves the geometric sum for affordable count.
- **Fuel & upkeep:** each source has `baseUpkeep = baseOutput × UPKEEP_FACTOR`; unit *k*
  drags `baseUpkeep × (k−1)`, so total upkeep is quadratic while gross output is linear ×
  milestones. Past a source's efficient band the next unit is a net **loss** — buy-max is no
  longer always right. Net output floors at 0 ("fully curtailed"): an overbought source
  idles, it never drains the grid. Milestone ×2s rescue overbought bands; per-tier
  efficiency research (`reduceUpkeep`) halves upkeep. Managers stop buying at the band edge.
- **Count milestones:** at `owned` ∈ {25, 50, 100, 150, 200, 300, 400, 500, 750, 1000...}
  the source's output ×2 (permanent, this run). This is the AdCap dopamine beat — surface
  "3 more to ×2" in the UI.
- **Total power/s:**
  `Σ over sources ( owned × baseOutput × sourceMilestoneMult × sourceResearchMult ) × globalMult`

### 3.2 Research (`engine/research.ts`, content in `content/research.ts`)

- **RP generation:** `researchRate = baseRate × (1 + rpBoosts) + kpRpBonus`. Base is small so
  research is a meaningful choice, not free.
- **Tech tree:** nodes with `id`, `name`, `cost` (RP), `prereqs` (node ids), `tier` gate, and
  an **effect**. Effect kinds:
  - `unlockSource(sourceId)`
  - `multSource(sourceId, x)`
  - `multGlobal(x)`
  - `multRpRate(x)`
  - `reduceMegaprojectCost(x)`
  - `increaseOfflineCap(seconds)`
  - `unlockAutomation(sourceId)` (auto-buy manager, AdCap-style)
- Prereqs create the **decision/discovery layer**: you can't buy everything, so which branch
  you push (cheap-and-wide vs deep-and-powerful) is the GDT-flavored choice.

### 3.3 Megaprojects (`engine/megaproject.ts`, content in `content/megaprojects.ts`)

One signature megaproject per Kardashev tier — the ascension gate.

- Fields: `id`, `name`, `tier`, `totalCost` (Power), `rpCost`, `stages`, `stageResearch`,
  `stageRewards` (per-stage multiplier bonuses), `completionReward`.
- **Building:** the player **commits Power** to it — either lump-sum deposits or by diverting
  a chosen % of income (a slider: "route X% of grid output to construction"). Progress =
  `committedPower / totalCost`.
- **Stage authorization (the research gate):** stage 1 is free; each later stage must be
  **authorized** for `rpCost / (stages−1)` RP before power can fill it, and stages 3/4/5
  additionally require the tier's key research nodes (`rp-t*`, `global-t*`, `mega-t*`).
  Power clamps at the authorized boundary — raw income can never rush the gate, so research
  is mandatory for every ascension.
- **Anti-softlock:** lump-sum commits are capped so that with zero income the player always
  keeps enough power to buy the cheapest unlocked source. You cannot brick a run by
  committing your last watts.
- **Stages** fill sequentially; each completed stage grants a small permanent multiplier and a
  visual beat (a Dyson ring lights up, etc.). Full completion **unlocks Ascend** for the tier.
- This is the Soda-Dungeon "run": set it going, watch it build, collect the payoff.

### 3.4 Ascension (`engine/ascension.ts`)

- **Available when** the tier's megaproject is complete.
- **KP gained:** `floor( K × sqrt( lifetimePowerThisTier / tier.baseCost ) )` — tune `K` so
  first ascension lands ~8–15 min in and later ones stay meaningful. Show the projected KP
  gain before the player commits.
- **On ascend:** reset `sources` (owned→0), `power→0`, current megaproject, per-run milestones.
  **Keep:** KP, purchased research (permanent), unlocked-tier knowledge. Advance `tier += 1`.
- **KP effect:** `prestigeMult = 1 + KP × KP_RATE` (start `KP_RATE = 0.02`, i.e. +2%/KP). Later
  a small KP spend-tree can be added, but linear global mult is the MVP.
- Advancing tier swaps in that tier's sources, megaproject, era name, and scale copy, and
  raises baseline costs — the world visibly levels up.

### 3.5 Milestones (`engine/formulas.ts`)

- **Per-source count milestones:** see 3.1 (×2 at count thresholds).
- **Global power milestones:** every ×1000 of lifetime-power-this-run grants a global ×1.6.
  `milestoneCount = runPower < 1000 ? 0 : floor( log(runPower/1000) / log(1000) ) + 1`.

### 3.6 Offline earnings (`engine/offline.ts`)

- On load: `elapsed = min(now − lastSaved, offlineCap)`; credit `powerPerSec × elapsed`.
- `offlineCap` starts at **4h**, raised by research. Show a "while you were away" summary.

### 3.7 Dispatch (active risk/reward beat, `engine/economy.ts`)

- **Charge model:** dispatch charge builds 0→100% over `DISPATCH_CHARGE_SECONDS`; firing
  spends it. Burst = `powerPerSec × DISPATCH_SECONDS × charge × demand` (demand 0.9–1.2).
  Can't fire below `DISPATCH_MIN_CHARGE`.
- **Peak-demand windows:** every 3–6 min a `PEAK_DURATION_SECONDS` window opens where the
  burst pays ×`PEAK_MULT`. The decision: fire early and often, or bank charge for a peak.
- Burst power goes to stored power/run-power; the megaproject's stage-authorization gate is
  what keeps dispatch from rushing ascensions.

### 3.8 Circuit puzzles (`engine/puzzle.ts`, skins in `content/puzzles.ts`)

The active "brain" beat — a logic mini-game, reskinned per tier ("Relay Yard" →
"Planck Lattice"), never required for progression.

- **Mechanic:** rotate wire tiles on an N×N grid until the source powers every
  district (sink). Generated as a recursive-backtracker spanning tree (every tile is
  part of one circuit), then rotation-scrambled with a computed `par`. Powered tiles
  light up live as you rotate. Grid grows with tier: 4×4 → 7×7 (cap).
- **Payout per manual solve:** Credits (`PUZZLE_BASE_REWARD + PUZZLE_TIER_REWARD × tier`,
  ×`PUZZLE_BONUS_MULT` if solved within `par + slack` moves) **plus** a
  **Grid Surge** — ×`SURGE_MULT` global power for `SURGE_MANUAL_SECONDS` (stacking,
  capped). The surge is the "strong bonus, never a wall" hook to the main loop.
- **Auto-Solvers (shop):** each unit solves one circuit per `SOLVER_SECONDS` in the
  background at `SOLVER_REWARD_FACTOR` of the manual base and a shorter surge. Enough
  of them (~6) keep the surge lit permanently — the layer plays itself.
- Free re-deal at any time (no reward). Puzzle re-deals on ascension; Credits,
  solvers, and streak persist.

### 3.9 Shop & daily rewards (`engine/shop.ts`)

The **Grid Exchange** — Credits only, acceleration only, no progression gates.

- **Daily connection bonus:** one claim per local calendar day. Consecutive days grow a
  streak through a 7-day reward table (`DAILY_REWARDS`); each completed week adds
  +`DAILY_STREAK_BONUS`. **One missed day is forgiven (grace day); two resets** — hard
  FOMO windows are the genre's most-hated pattern (AdVenture Communist post-mortems).
- **Auto-Solver:** cost `SOLVER_BASE_COST × SOLVER_COST_GROWTH^owned`.
- **Boosts:** ×2 power 15 min, ×2 RP 15 min, instant dispatch recharge. Boost timers
  tick down in game time and stack additively in duration, not multiplier.

### 3.10 Records (achievements, `engine/achievements.ts`)

17 achievements spanning ownership counts, lifetime power, research, tiers, puzzles,
streaks, and solvers. Each grants a permanent global ×(1+`ACHIEVEMENT_BONUS`). Earned
list persists through ascension; shown as a grid in the Ascend tab, toast on earn.

### 3.11 Age frames & transmissions (`ui/components/AgeFrame.tsx`, `content/transmissions.ts`)

The home screen **is** the world (design 2a), and each of the eight ages dresses it
differently (design 4b): Athens → the colonies' coast → a dusk skyline under the Pharos →
a space-elevator launch deck → a platform at the sun → the rim of a black hole → the
galaxy → spacetime coming apart. A frame supplies era scenery tokens (`--sky`, `--stone`,
`--marble`, `--sun`, `--scene-ink`, plus cat fur for the dark ages) and a backdrop; the
altar, plinth and installations are age-agnostic and recolour from those tokens. The
constant is the **colonnade**, present in every age — one civilisation climbing, not eight
skins. A transmission flavour line low on the floor reacts to lifetime power. Ascension
plays a title-card overlay (era, Kardashev badge, +KP) instead of a toast.

Two constraints any new frame must respect: the HUD owns the top 26.5% and the floor's
back edge sits at 38%, so **all sky detail lives in that ~93px band**; and the colonnade
owns the centre, so landmarks belong off to one side. `?age=N` in dev pins a frame.

The earlier three.js tier scenes (`ui/three/**`) were deleted once the courtyard replaced
them — they had become an unreachable code path, and dropping them took `three` out of
the dependency list entirely.

### 3.13 Grid physics — the three-lane bottleneck (`engine/grid.ts`, `content/grid.ts`)

The Egg Inc engine (lay rate / habitats / shipping) in electrical terms. Delivered
power = `min(generation, V×A cap) × (1 − loss)`:

- **Generation** — the existing source economy (gross W).
- **Transmission** — transformers (voltage class) × conductors (ampacity) set the
  carried-power cap. Generation above it is stranded ("GRID CONGESTED").
- **Losses** — I²R drag (`LOSS_BASE` 15% at level 0, floor 0.5%). Voltage upgrades cut
  losses AND raise the cap (V↑ ⇒ I↓ ⇒ I²R↓↓ — real physics, double value); the
  superconductor lane is pure efficiency.

Three upgrade lanes per tier, priced in Credits (§3.15), reset on ascension (infrastructure is
rebuilt each era; per-tier flavor names in `content/grid.ts`). The cap base scales with
prestige so KP never strands a run — only **within-run** growth (count milestones,
global milestones) outpaces it, which is the intended pressure. The Transmission panel
sits atop the Grid tab with the binding constraint highlighted. Pre-v5 saves are
grandfathered with enough transformer levels to carry their current generation.

### 3.14 Per-tier mechanical twists (`engine/tierTwists.ts`)

Answers the "skin replication" risk below directly: T3, T5, and T6 each get one small
distinct mechanic, inert outside their own tier and reset on ascension like grid/puzzle.
All three fold into the existing `ResearchModifiers` bag (economy/megaproject/offline/
loop already thread it everywhere) rather than adding new call-site parameters.

- **T3 Orbital — Launch Windows.** A window opens periodically (`LAUNCH_WINDOW_DURATION_
  SECONDS` every `LAUNCH_GAP_MIN/MAX_SECONDS`); orbital purchases cost normal price inside
  it, `×LAUNCH_SURCHARGE` outside. Automation still buys off-window, just less
  efficiently — never a hard wall, only a timing incentive.
- **T5 Exotic — Accretion Disk.** Player sets a feed rate (0–100%, default 0, a slider
  like route%): `+ACCRETION_OUTPUT_BONUS` output and `+ACCRETION_UPKEEP_PENALTY` upkeep,
  both linear in feed rate. Heat fills proportionally and maxing out fires a **flare** —
  a one-off power burst (`ACCRETION_FLARE_SECONDS` of current output), then resets. Pure
  upside, timing-based — no RNG punishment.
- **T6 Galactic — Relay Routing.** A slider (0–100%, default 0) diverts the relay network
  from power delivery to the research array: `-RELAY_POWER_PENALTY` power,
  `+RELAY_RP_BONUS` RP rate, both linear in allocation. A straight power↔RP trade (not a
  raw currency conversion) so it can't silently dominate either resource regardless of
  what tier-scale the numbers are at.

### 3.12 Save safety

Saves that fail to load are preserved under `kardashev:recovery:*`, never discarded.
A rolling backup (`kardashev:backup`) is written on autosave with a **monotonic
lifetime-power guard** — a lower-progress state can never overwrite it — and is
restorable from the Ascend tab. (Lesson learned the hard way + CIFI's serialization
complaints.)

### 3.15 The Dispatch Board — power vs. money, a live grid economy (`engine/market.ts`)

Separates *what you produce* (power) from *what you spend* (**Credits/CR**, now the one
currency all buys, grid upgrades, and the shop share). Generation is no longer banked as
Watts — each tick it's a live flow split across **three rails that sum to ≤ 1** (two
sliders on the Dispatch Board; the grid takes the remainder):

- **Sell** (`sellPct`) → CR at a **floating price**: `price = BASE_PRICE / (1 + saturation)`,
  where `saturation` relaxes toward `MARKET_SATURATION_GAIN × sellPct` over `MARKET_TAU`
  seconds. Dumping a bigger share sags the price; easing off lets it recover — the "live
  economy." Driven by the *fraction* sold, so it's tier-invariant and never imports the
  economy layer (no cycle with generation).
- **Project** (`routePct`, the old route slider) → megaproject `committed`, clamped to the
  authorized boundary; un-committable overflow spills back to the Sell rail.
- **Grid** (remainder) must cover a demand floor `DEMAND_FRACTION × generation`. Under-serve
  and output is throttled by `brownoutMult = 1 − shortfall × BROWNOUT_SEVERITY`, applied
  last in `generationPerSec` — self-limiting, since lower output lowers demand.

**Megaproject source cost:** completing a stage dismantles `STAGE_DECOMMISSION[stage]` of the
fleet, lowest-`baseOutput` source first (escalating fractions, so late stages reach your best
plants) — building the wonder cannibalizes the grid. Fires once per stage via a persisted
`decommissionedStages` counter; old saves are grandfathered so a load never retro-charges.

**Lab levers (one per rail).** Research now has real purchase on the economy, not just raw
output: `multCredits` (+25% CR/W sold), `reduceDemand` (−20% grid demand floor), and
`reduceDecommission` (−30% of the stage dismantle). They compound, so they are deliberately
*not* on every tier — credits ×8, demand ×4, salvage ×3 — enough to feel like mastery without
erasing the brownout tension. They ride the existing `ResearchModifiers` bag; `market.ts`
takes them as plain number params rather than importing research, which would close a
`research → tierTwists → market` cycle. The Lab also rings **project-critical** nodes in
violet (a megaproject stage is gated behind them) with a "N blocks the build" counter.

**Offline** runs the same split (Sell → CR, Project → committed) and the welcome-back modal
leads with CR earned plus a **×2 claim** (the rewarded-ad hook; the ad gate itself lands with
the native/Capacitor build). Save schema v7 retires the Watt bank, converting any banked power
to CR at `BASE_PRICE`. Key pacing knob for the M7 balance pass: `BASE_PRICE`.

### 3.16 Progressive disclosure (`engine/unlocks.ts`)

The genre tolerates enormous depth but punishes depth that arrives **all at once on
screen one**. Measured on a 375×812 phone, the pre-fix Sources tab put the Dispatch Board
at y=387 and Transmission at y=656, pushing the first **Buy** button — the game's primary
verb — to y=863, *below the fold*. Two fixes:

1. **Systems unlock one at a time**, keyed on `stats.lifetimePower` so the gate is derived
   (no save field), monotonic, and permanent across ascensions — once learned, never hidden.
   Each is **inert until unlocked**, not merely invisible, so a player can never be punished
   by a mechanic that isn't on screen:
   - Below `UNLOCK_BOARD_POWER` there is no Board: all generation sells (`effectiveSellPct`
     = 1, so income always exists), nothing routes, and the price is flat at `BASE_PRICE`
     with the market unable to saturate. The game is simply "buy a thing, number goes up."
   - `UNLOCK_GRID_DEMAND_POWER` turns on the demand floor and brownout — the first real
     constraint on dumping everything into Sell.
   - `UNLOCK_TRANSMISSION_POWER` reveals the V×A cap / loss panel.
   Each arrival fires a toast so a system never silently appears. Staggering them in *time*
   also stops Transmission and Grid-demand (both "your power doesn't all arrive") from
   landing as one confusing lump.
**The cold open + the objective line.** The reskin put the premise in the item names but
nothing ever *told* the player humans are gone, so the hook was invisible. `IntroOverlay`
plays four skippable beats once (`kardashev:ui:intro`), ending on "Steal the lightning".
`engine/objectives.ts` then keeps exactly one "what now?" line on screen — pure and derived
from state (no stored quest data, nothing to migrate, can't drift out of sync), walking the
same beats these unlocks reveal: first source → grow → first research → open the Board →
route to the project → whatever is actually blocking the next stage → ascend.

2. **The Board collapses to a one-line strip** (`⚡ sell 60% · 0.53 CR/W · +N CR/s`),
   remembered in `kardashev:ui:board`. Allocation is a set-and-adjust decision, not a
   per-tap one, so it defaults closed and the buy buttons stay above the fold (measured:
   first Buy 863 → 633px with every system unlocked).

### 3.17 Megaprojects must scale with prestige (`content/megaprojects.ts`)

**Measured bug, 2026-07-21.** Generation scales with `prestigeMult` (KP) without bound, but
`megaCost` only scaled with *tier*. With a deliberately tiny 20-unit buildout:

| KP | generation | project cost | time to fill the whole project |
|---|---|---|---|
| 0 | 5.25 W/s | 3.5e5 | ~5 days |
| 1e3 | 110 W/s | 3.5e5 | ~6 hours |
| 1e6 | 105 kW/s | 3.5e5 | 22 seconds |
| 1.7e7 | 1.79 MW/s | 3.5e5 | **1.3 seconds** |

The tier gate had silently stopped existing. The fix: `buildMegaproject(tier, prestigeCostMult)`,
called from `ascend` with `prestigeMult(s.kp)`. Fill-time then depends only on how well you
built *this* run — prestige-invariant, which is what a gate should measure.

**Corollary — costs must move with whatever scales output.** Raising CR income would have made
this *worse* (more CR → more sources → more generation → faster fill). A sweep confirmed CR is
not the binding constraint: with a rational buyer that refuses curtailing units, generation
hard-stops (quadratic upkeep) and 566k banked CR cannot move it — only research can.

**In-flight builds are grandfathered.** `SaveData.megaTotalCost` stores the project's price, so
a rebalance never re-prices a build already underway; a save without it keeps the base cost.
`ascend` also seeds **CR**, not Watts — the Watt bank has been retired since §3.15, and seeding
it would strand a player with no money at a new tier.

### 3.18 The demand index & the Arbitrage Desk (`engine/market.ts`, `engine/arbitrage.ts`)

**The market used to only echo the player.** `gridPrice` was `BASE / (1 + saturation)`, and
saturation is driven entirely by the Sell slider — so the "live economy" moved only when you
moved it. The **demand index** is the missing half: a mean-reverting random walk (a discrete
Ornstein–Uhlenbeck step, `√dt`-scaled so it behaves the same at 20 Hz or in one offline slab)
that multiplies the price. Now the market moves on its own, and watching it matters whether or
not you ever trade.

    price = BASE_PRICE / (1 + saturation) × index
            └── you control this ──┘       └── you don't ──┘

**The Arbitrage Desk** (Agora) trades against it: buy Watts off your own grid into a battery
when demand is low, release them when it's high. Battery capacity is a window of current
generation (`RESERVE_CAPACITY_SECONDS`), so it scales across tiers with no per-tier table, and
a weighted-average cost basis is kept so profit — including losses — can be reported honestly.

**`RESERVE_EFFICIENCY` is load-bearing, not flavour.** Without a round-trip loss, store→release
in the same instant would be free money. At 0.92 an immediate flip loses 8%, so only genuine
price movement pays. Verified live: 18,884 CR stored and instantly released returned 17,374.

#### Why this is not gambling — and the shape that would make it gambling

This shipped first as a **futures desk**: stake Credits, wait out a clock, win or lose on a
price tick. That was a mistake. Apple's *Simulated Gambling* rating covers wagering virtual
currency on an outcome and explicitly includes betting on races; a bet on a price tick is the
same shape however it's dressed, and misdescribing content can pull a live app.

The replacement is categorically different, and each property is deliberate:

| Wager (removed) | Arbitrage (shipped) |
|---|---|
| Stake at risk | You hold **Watts**, not a bet |
| Fixed settlement clock | **No timer** — hold indefinitely |
| Outcome from a draw | Outcome from **when you act** |
| House edge on payout | Round-trip efficiency loss |

A test asserts that five minutes of ticking never touches an open position — the engine cannot
close it, only the player can. **If the desk ever regains a timer, a forced settlement, or a
random payout, the age-rating answer must change** (see `docs/APP_STORE.md`).

> ⚠️ **Selling Credits as IAP would re-regulate this.** Real-money currency purchase *plus*
> trading that currency against a moving market is a speculation loop, even though each half is
> fine alone. `PRODUCTS.creditsSmall/Large` must stay unshipped while this desk exists.

Also guarded: if generation collapses (decommission, brownout, ascension) the battery shrinks,
and `settleOvercapacity` refunds the spill **at cost** rather than deleting paid-for Watts.

---

## 4. The Kardashev ladder (content: `content/tiers.ts` + `content/sources.ts`)

Grounded physics at the bottom → full sci-fi at the top, per the brief. Each tier lists its
sources (cheapest → priciest) and its gating megaproject. Output values are **relative
starting points**; the ×~5 step between sources is what matters, absolute values get tuned.

| Tier | Era | Scale you power | Signature megaproject | Kardashev |
|---|---|---|---|---|
| 0 | **Fossil Age** | a household → a city | National Smart Grid | — |
| 1 | **Renewable Age** | a region | Continental Interconnect | — |
| 2 | **Atomic Age** | a nation → a planet | Planetary Fusion Grid | **Type I** (~10¹⁶ W) |
| 3 | **Orbital Age** | near-Earth space | **Dyson Swarm** (rings) | — |
| 4 | **Stellar Age** | a whole star | **Dyson Sphere** | **Type II** (~10²⁶ W) |
| 5 | **Exotic Age** | black holes & stellar engines | Stellar Engine (Shkadov) | — |
| 6 | **Galactic Age** | a galaxy | Galactic Power Web | **Type III** (~10³⁶ W) |
| 7 | **Transcendent** | spacetime itself | Vacuum Kernel (zero-point) | Type IV+ |
| 8+ | **Kardashev IV.x** | endless prestige tail | procedural | — |

**Sources per tier** (name — flavor; costs/outputs go in content, ×~5 output per step):

- **T0 Fossil:** Battery Bank · Diesel Genset · Coal Plant · Gas Turbine
- **T1 Renewable:** Solar Farm · Wind Farm · Hydro Dam · Geothermal Plant
- **T2 Atomic:** Fission Reactor · Breeder Reactor · Fusion Tokamak
- **T3 Orbital:** Orbital Solar Array · Space Elevator Tap · Antimatter Plant
- **T4 Stellar:** Star-Lifter · Solar Statite Swarm · Dyson Node
- **T5 Exotic:** Penrose Black-Hole Ring · Hawking Tap · Matrioshka Node
- **T6 Galactic:** Neutron-Star Tap · Quasar Collector · Galactic Relay
- **T7 Transcendent:** Zero-Point Extractor · Wormhole Siphon · Vacuum Turbine
- **T8+:** procedurally named ("Exotic Source Δ-n") for the infinite tail

**Era copy** should sell the scale — the header reads e.g. "Powering: a single household" →
"…a fleet of hyperscale datacenters" → "…the entire galaxy." Write it to feel like leveling
up a civilization.

---

## 5. Balancing constants (starting values — live in content/config)

```
COST_GROWTH             = 1.13     // per-source cost multiplier
SOURCE_MILESTONES       = [25,50,100,150,200,300,400,500,750,1000, ...]  // each ×2
GLOBAL_MILESTONE_STEP   = 1000     // every ×1000 run-power
GLOBAL_MILESTONE_MULT   = 1.6
ERA_MULT_BASE           = 4        // baseline ×4 per tier
KP_RATE                 = 0.02     // +2% global per Kardashev Point
KP_GAIN_K               = 3        // scales ascension payout
BASE_RESEARCH_RATE      = 0.5      // RP/sec at start
OFFLINE_CAP_SECONDS     = 28800    // 8h, +research (t0/t2/t3/t5 nodes)
ACHIEVEMENT_BONUS       = 0.01     // +1% global per record
UPKEEP_FACTOR           = 0.05     // baseUpkeep = baseOutput × this
DISPATCH_SECONDS        = 30       // burst = pps × this × charge × demand
DISPATCH_CHARGE_SECONDS = 90       // 0→100% charge time
DISPATCH_MIN_CHARGE     = 0.25
PEAK_MULT               = 3        // peak-demand window bonus
PEAK_DURATION_SECONDS   = 25
PEAK_GAP_SECONDS        = 180–360  // rolled per window
megaproject t0          = 350 kW power + 400 RP authorizations
PUZZLE_BASE_REWARD      = 10 CR (+6/tier; ×1.5 within par+2 moves)
SURGE                   = ×1.5 power · +60s/manual solve · +15s/auto · cap 300s
SOLVER                  = 100 CR base, ×1.35/owned, 1 solve / 90s @ 50% reward
BOOSTS                  = ×2 power 250 CR · ×2 RP 200 CR · dispatch refill 75 CR (15 min)
DAILY_REWARDS           = [50,75,100,150,200,300,500] CR, +10%/week streak
LAUNCH_WINDOW           = 20s open, 60-120s gap, ×1.4 surcharge off-window (T3)
ACCRETION               = +60% output / +120% upkeep @ 100% feed, flare = 30s output (T5)
RELAY_ROUTING           = -35% power / +150% RP @ 100% allocation (T6)
```

**Pacing targets** (verify in M7): first *buy* within seconds; first source *milestone*
~1 min; first *research node* ~2 min; first *megaproject complete + ascension* **~30–45 min**
(the RP authorization gate and stage research locks set the floor — raw power can't rush it).
Each subsequent tier should feel faster to re-climb thanks to KP.

---

## 6. Number formatting (`engine/format.ts`)

- Suffix ladder: `W, kW, MW, GW, TW, PW, EW, ZW, YW`, step 1000. Above YW → scientific
  (`1.23e27 W`). Below 1000 → integer (or one decimal under 10).
- RP and KP are small integers — plain formatting.
- Provide `formatPower(n)`, `formatShort(n)`, `formatTime(seconds)`.

---

## 7. UX & juice

- **Aesthetic:** high-voltage control room / SCADA readout. Deep grid-blue-black, electric
  cyan (live current), voltage amber (power/energy), violet (ascension). Monospace for all
  numeric readouts (meter feel); a technical display face for headers. Tokens in
  `src/ui/theme/tokens.css` — carry these palette values.
- **Signature element:** a live top **power meter** that ticks like a real instrument, plus
  the megaproject that visibly assembles stage by stage (rings lighting up for the Dyson
  builds). Spend the boldness there; keep everything else quiet.
- **Feedback:** toasts for milestones, research completions, megaproject stages, ascensions
  ("⚡ ENERGIZED — +N Kardashev Points"). Number-roll on big jumps. Respect
  `prefers-reduced-motion`.
- **Layout (mobile-first, ~380px):** meter + resources at top → tabbed body
  (Sources / Research / Megaproject / Ascend) → primary action bar pinned bottom.
- **Copy voice:** plain, active, engineer's register. Buttons say what happens ("Commit
  power", "Ascend"). Empty/blocked states give direction, not mood.

---

## 8. Explicitly out of scope for v1

Multiplayer/leaderboards, accounts/cloud save, monetization,
prestige-of-prestige layers beyond KP. Note anything you
want to add in this section rather than building it mid-milestone.

**Design risk from genre analysis (addressed):** later tiers used to just rescale the
same mechanics ("skin replication" — Cat Snack Bar's core criticism). Fixed in §3.14:
T3/T5/T6 each got one small distinct mechanic. T4/T7/T8+ still ride the base loop only —
candidates for future twists if the same critique resurfaces there.
