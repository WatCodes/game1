# Tutorial — teaching the three currencies

Decided 2026-09-30 after playtest feedback: players could not tell what CR, RP and
KP are, how to earn them, or what raises them. They also asked for "less words",
so the answer is *timing*, not volume.

## Principle

**Teach each thing at the moment it first matters, once.** Explaining Kardashev
Points thirty seconds in is the tutorial everyone skips — it means nothing yet.
Every beat is at most two sentences. Anyone who wants the long version taps a
currency chip (see below), so the beats never have to carry it.

## The moments

| Moment | Style | Due when | Done when |
|---|---|---|---|
| Intro | tell | first launch | tapped through — premise and the right rail only |
| Credits | do | after the intro, nothing ever bought | a power source is owned |
| Altar | do | the altar can actually fire, on an early save | the player has channelled once |
| Research | do | first research is affordable, none ever bought | a research is bought |
| Kardashev Points | tell | Wonder ≥ `TUTORIAL_KP_PROGRESS`, never ascended | tapped |

The Dispatch Board was proposed and **deliberately left out**.

The altar is here rather than in the intro on purpose. The intro used to teach it
first, but dispatch sells a slice of *generation*, and a new player has none, so
the opening instruction could not be followed (see 1.0.1's Channel fix). As a
moment it appears only when tapping it will work.

## Two styles

- **Tell** — the intro's spotlight: scrim, Pyrrha, tap to continue. For concepts.
- **Do** — a *coach mark*: Pyrrha's bubble beside the real control, a pulsing ring
  on it, **no scrim**, the whole game stays usable. It stays until the player does
  the thing, or dismisses it with ✕. For actions.

Do-beats are not a hole punched in the scrim. That design can trap a player behind
an overlay they cannot act through; a coach mark cannot trap anyone, and still
waits for the action — which is what "forced" was asking for.

## Rules

- **Veterans see nothing.** A beat is only due if the player has not already done
  the thing: no sources and never generated, never researched, never ascended. The
  app is live; someone three hours in must not be told what Credits are. The altar
  has no "ever channelled" record, so it is gated on lifetime power instead
  (`TUTORIAL_ALTAR_MAX_LIFETIME`).
- **One at a time, never on top of anything.** Nothing shows while the intro, away
  summary, ascension, a panel, or the Field Manual is open. A pending beat waits.
- **Once is once.** Seen flags live in UI storage (`kardashev:ui:moments`), like the
  intro's own flag — not in the save, so the save format is untouched.
- **Always escapable.** Every beat can be dismissed, and dismissing counts as seen.
- **The control must be visible, not merely present.** A beat's anchor has to be
  the topmost element at its own centre. Added after playtesting: the altar beat
  fired while the power-sources sheet was open and drew its ring over the sheet,
  pointing at an altar nobody could see. Now anything covering a control — sheet,
  panel, anything added later — makes its beat wait.

## Found while playtesting this

- **The altar could not be tapped on iPhone, before any of this existed.** iOS
  delivered pointerdown, pointerup and touchend to it and then declined to
  synthesize the click (WebKit drops a tap's click when content is changing under
  it, and the altar sits in a constantly animating scene). Confirmed with no
  tutorial on screen. It now fires on pointerup — see `Courtyard.tsx`. Every
  earlier test used a scripted `.click()`, which skips exactly the step iOS drops.
  **Test taps on the device, with a finger, not with `.click()`.**
- **The currency cards render through a portal.** Nested in the header, they were
  drawn under the ♪, ? and rail buttons, which share its z-index and come later.

## Currency chips

The RP, CR and KP chips in the header are tappable. Each opens a short card: what
it is, how you earn it, what raises it, what you spend it on — with the player's
own live numbers. This is where the detail lives, so the beats can stay short.

## Where things are

- `src/engine/tutorial.ts` — which moment is due, from game state. Pure, tested.
- `src/content/tutorial.ts` — every word Pyrrha says, and the chip copy.
- `src/ui/components/TutorialLayer.tsx` — sequencing, persistence, coach marks.
- `src/ui/components/CurrencyCard.tsx` — the chip cards.
