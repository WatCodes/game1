# Game Center

Two leaderboards, shipped in 1.0.3. Achievements come later: each of the 17 needs its
own image in App Store Connect.

| Leaderboard | ID | Score | Why this one |
|---|---|---|---|
| **Kardashev Points** | `electriccats.kp` | Lifetime KP, whole number | The game's own measure of how far you've climbed. It never goes down. |
| **Ascension Level** | `electriccats.ascension` | The age you've reached (= ascensions completed) | The simplest "how far have you climbed" — everyone understands it. |

**Best Trade was dropped (2026-10-02).** It was created in App Store Connect as
`electriccats.besttrade` before Wyatt chose an ascension board instead. It is
never attached to a version and the game never sends to it, so players never see
it — and Apple never lets that ID be reused, so don't try.

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

**2. App Store Connect: create the leaderboards. — DONE 2026-10-02.**
Distribution → App Store → Growth & Marketing → **Game Center**. Both are Classic,
Integer, Best Score, High to Low, with an English (U.S.) localization:
`electriccats.kp` ("Kardashev Points", suffix ` KP`) and `electriccats.ascension`
("Ascension Level"). The IDs must match `LEADERBOARD_*_ID` in
`src/content/config.ts` exactly.

**3. On the 1.0.3 version page:** tick **Game Center** and add **Kardashev Points** and **Ascension Level** (not Best Trade)
before submitting. Leaderboards that aren't attached to a version stay invisible to
players.

**4. Test on TestFlight.** TestFlight builds use the Game Center sandbox
automatically. Sign in when the sheet appears after the intro, ascend once (the dev cheat
panel isn't in release builds, so play to it or use an imported save), background the app, then open ASCEND → LEADERBOARDS.
