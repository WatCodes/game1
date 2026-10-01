# Game Center

Two leaderboards, shipped in 1.0.3. Achievements come later: each of the 17 needs its
own image in App Store Connect.

| Leaderboard | ID | Score | Why this one |
|---|---|---|---|
| **Kardashev Points** | `electriccats.kp` | Lifetime KP, whole number | The game's own measure of how far you've climbed. It never goes down. |
| **Best Trade** | `electriccats.besttrade` | Best single Market release, profit ÷ cost, in tenths of a percent (523 = 52.3%) | Skill rather than grind, and independent of era. A new player can top it. |

The real-world Kardashev formula (log₁₀ W) was considered and rejected. The game's
era labels ("Type I" at the Age of Dominion) don't match it in actual watts, so that
leaderboard would contradict the game.

## Code

- `src/engine/leaderboards.ts` turns state into scores. It is pure and tested. A score
  of 0 is never posted.
- `src/platform/gameCenter.ts` handles sign-in, throttled submission and the
  leaderboard screen. Everything is fire-and-forget, and everything is a no-op on
  the web, on Android, and when not signed in.
- `ios/App/App/GameCenterPlugin.swift` is written in-app because no maintained npm
  plugin supports Capacitor 8 (`@openforge/capacitor-game-connect` stops at 5). It is
  registered by `MainViewController.swift`, which `Main.storyboard` now uses in place
  of `CAPBridgeViewController`.
- `ios/App/App/App.entitlements` holds `com.apple.developer.game-center`.

Rules the code keeps:

- **Sign-in waits for the intro.** Apple asks for sign-in at launch, but a brand-new
  player's first screen is the game, not Apple's sheet.
- **Sign-in has a 15 s timeout.** GameKit does not always answer. On the Simulator
  with no account it never called back, and the Leaderboards button would have
  waited forever.
- **Scores post when they improve,** at most every 5 minutes, and unthrottled when the
  app is backgrounded. Each board's last-sent best is stored in UI storage
  (`kardashev:ui:gc-sent`), not in the save.
- `desk.bestReturn` is capped at `LEADERBOARD_MAX_RETURN` (×20) on load, so a
  hand-edited save can't post an impossible score. Real play tops out around ×7: the
  index range (0.55–1.75) × saturation (up to 2.5) × efficiency.

## Privacy

There is no label change: **Data Not Collected** still holds. Apple's guidance says
"collect" means transmitting data off the device where *you* can access it, and
"You are not responsible for disclosing data collected by Apple." The game sends
nothing anywhere. Scores go to Apple through GameKit.
(developer.apple.com/app-store/app-privacy-details, checked 2026-10-01)

## One-time setup (Wyatt — in this order)

**1. Developer account: give the App ID Game Center.**
The current "Electric Cats App Store" profile has no Game Center entitlement, so an
archive with `App.entitlements` will fail to sign until this is done.
1. developer.apple.com → Certificates, IDs & Profiles → **Identifiers** →
   `com.watcodes.electriccats` → tick **Game Center** → Save.
2. **Profiles** → "Electric Cats App Store" → Edit → Save. This regenerates it with
   the new capability. Download it and double-click to install. Signing is manual, so
   the name must stay exactly "Electric Cats App Store".

**2. App Store Connect: create the leaderboards.**
Electric Cats → **Features** (or Services) → **Game Center** → Leaderboards → **+** →
Classic Leaderboard:

| Field | Kardashev Points | Best Trade |
|---|---|---|
| Reference name | Kardashev Points | Best Trade |
| Leaderboard ID | `electriccats.kp` | `electriccats.besttrade` |
| Score format type | Integer | Fixed Point, **1** decimal place |
| Score submission | Best Score | Best Score |
| Sort order | High to Low | High to Low |
| Score range (optional) | 1 – 9,007,199,254,740,991 | 1 – 20,000 |
| Localization: name | Kardashev Points | Best Trade |
| Localization: score suffix | ` KP` | `%` |

The IDs must match `LEADERBOARD_KP_ID` / `LEADERBOARD_BEST_TRADE_ID` in
`src/content/config.ts` exactly. **They can't be changed or reused once created.**

**3. On the 1.0.3 version page:** tick **Game Center** and add both leaderboards
before submitting. Leaderboards that aren't attached to a version stay invisible to
players.

**4. Test on TestFlight.** TestFlight builds use the Game Center sandbox
automatically. Sign in when the sheet appears after the intro, make a profitable
Market trade, background the app, then open ASCEND → LEADERBOARDS.
