# App Store listing copy — Electric Cats

Paste-ready text for App Store Connect, with character counts. **Check every count
after editing** — Apple silently truncates in some fields and rejects in others.

> Field limits: name **30**, subtitle **30**, keywords **100**, promotional text
> **170**, description **4000**.

---

## 1. Name (30 max)

**Primary choice — 26 chars:**

```
Electric Cats: Idle Tycoon
```

Why not just "Electric Cats" (13): nobody searches for a brand that doesn't exist
yet. The name field is the single heaviest ranking signal in App Store search, so
the strongest keyword you own — **idle** — belongs in it. "Tycoon" pulls in the
management-sim audience that overlaps hardest with idle players.

Alternates if that reads too generic to you:

| Option | Chars | Trade |
|---|---|---|
| `Electric Cats: Idle Empire` | 26 | "Empire" is warmer, "Tycoon" ranks better |
| `Electric Cats — Idle Power` | 26 | Most on-theme, weakest keyword pull |
| `Electric Cats` | 13 | Cleanest brand, worst discoverability |

⚠️ **Check availability first.** If another app holds "Electric Cats", everything
downstream changes — icon, screenshots, this whole file. Reserve the name in App
Store Connect before writing anything else.

## 2. Subtitle (30 max)

**Primary — 29 chars:**

```
Steal lightning, build a grid
```

It's concrete, it's the actual premise, and it uses verbs. Avoid restating words
already in the name — they're indexed once, and repeating them wastes the field.

Alternates:

- `Purr-powered energy empire` (26) — leans on charm over mechanics
- `Idle grid-builder with cats` (27) — clearer genre, duplicates "idle"

## 3. Keywords (100 max, comma-separated, **no spaces after commas**)

```
incremental,clicker,prestige,energy,electricity,offline,upgrade,tap,manager,kitten,zeus
```

**86 chars.** Rules baked into this string:

- No spaces after commas — each one would burn a character for nothing.
- **No words already in the name or subtitle** ("idle", "cats", "tycoon",
  "lightning", "grid") — Apple indexes those fields already, so repeating them
  spends your 100 characters on nothing.
- Singular only; Apple matches plurals automatically.
- No competitor names — that's a rejection risk, not a clever growth hack.

Spare terms if you want to swap: `simulator`, `physics`, `factory`, `ascend`,
`kardashev`, `greek`, `automation`, `capitalist`.

## 4. Promotional text (170 max)

Changeable **without shipping an update** — use it for news, not evergreen copy.

```
The cats have inherited the world and they want the lightning back. Start with one
kneading paw; end up wiring the galaxy. New: a living courtyard for every era.
```

**162 chars.**

## 5. Description

First **~3 lines** are all anyone reads before tapping "more". Everything load-
bearing goes up top; the feature list is for the people already sold.

```
Humans are gone. The cats remain — and they've decided the lightning Zeus hoards
belongs to them.

Electric Cats is an idle power-empire game. It starts with a single cat making
biscuits for about two watts a second. It ends with your paws on the energy budget
of a galaxy.

BUILD THE GRID
Kneaders, yarn dynamos, scratching-post turbines, sunbeam napperies. Every
generator you buy is a real line on a real grid — and every one of them costs
upkeep, so overbuilding a bad plant will curtail it.

POWER ISN'T MONEY
Generation is a live flow, not a bank. Split it across three rails on the Dispatch
Board: sell it for Credits at a floating market price, pour it into your Wonder, or
keep the city's lights on. Flood the market and the price sags. Starve the grid and
you brown out. Balance is the game.

RAISE A WONDER
Each era is gated by one signature megaproject — the Temple of Zeus, the Nine
Roads, the Great Sunbed. They're built stage by stage from routed power, gated by
research, and they cost you: finishing a stage dismantles your weakest plants to
feed the next one.

CLIMB THE KARDASHEV SCALE
Athens. The colonies. The whole world. Orbit. The sun. A black hole. The galaxy.
Spacetime itself. Ascend and you trade your buildout for permanent multipliers,
then do it all again, faster — and each age has its own sky, its own architecture,
and its own cats.

MIND THE PHYSICS
Power has to be carried, not just made. Transformers and conductors set what your
grid can deliver; line losses eat the rest. Outgrow your transmission cap and your
generators are just expensive scenery.

WHILE YOU'RE AWAY
The cats keep the grid running. Come back to a full tally of what they earned —
and the option to double it.

NO NONSENSE
No forced ads, ever. No timers blocking your progress. No account, no sign-up, no
data collection — your save lives on your device, and you can export it whenever
you like. Rewarded videos are strictly optional, and if one won't load, you get the
bonus anyway.

Steal the lightning. Light the world.
```

**~1,900 chars** — comfortably inside 4,000, and short enough that people finish it.

## 6. What's New (for the first release)

```
First release. The cats have the lightning. Please tell us what breaks.
```

## 7. Screenshot shot-list

Order matters more than count — screenshot 1 does most of the converting, and many
people never swipe. Capture on the **largest iPhone simulator** and let Apple scale
the rest down.

| # | Screen | How to get it | Caption to overlay |
|---|---|---|---|
| 1 | Athens courtyard, mid-build | Fresh save, ~15 generators, sources visible | **Steal lightning from the gods** |
| 2 | Dispatch Board expanded | Board open, all three rails non-zero | **Sell it, build with it, or keep the lights on** |
| 3 | The Wonder | Wonder pop-up, 2–3 stages lit | **Raise a Wonder to climb an era** |
| 4 | A later age | `?age=5` (Erebus) or a real high-tier save | **Athens to the event horizon** |
| 5 | While you were away | Backdate a save's `lastSaved` | **The cats keep working** |

**Use a fresh tier-0 save for shots 1–3.** The Athens courtyard and readable early
numbers sell the game; a maxed Aether run shows `1.36e27 W/s`, which means nothing
to a browsing stranger and actively looks broken.

Add a short text overlay to each — bare screenshots of a UI convert poorly.

## 8. Category and rating

- **Primary category:** Games → Simulation. (Secondary: Games → Strategy.)
  Simulation is the better home for grid/tycoon play; Casual is more crowded and a
  worse thematic fit.
- **Do NOT opt into the Kids category.** The cat art invites it, but it imposes
  advertising restrictions that conflict with running AdMob at all.
- Answer the age-rating questionnaire honestly. No violence, no gambling (the
  market price is not a wager), no user content, no unrestricted web access. The
  presence of ads is what will set the floor.
