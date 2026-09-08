# App Store submission runbook

Ordered so that everything not needing a Mac happens first. Listing copy lives in
[ASO.md](ASO.md); native build mechanics in [NATIVE.md](NATIVE.md).

> **Sitting at the Mac now?** [MAC_DAY.md](MAC_DAY.md) is the executable version
> of Phases 4–6 below — a self-contained, agent-followable runbook with the ids
> inline, verification after each step, and the human-only steps marked.

**Legend:** ⬜ doable on Windows now · 🍎 needs the Mac · ⛔ blocker

---

## ⛔ 1.0 was REJECTED on 2026-08-26 — simulated gambling. Read this first.

**Submission ID `1111638f-0f34-4505-9fcd-bbe784c21d3d`. Reviewed on an iPad Air
11-inch (M3), version 1.0 (7).** The review took **14 days**, not the 48 hours
Apple's confirmation email advertises. Plan resubmissions accordingly.

Apple's finding, paraphrased: individual (non-organization) developer accounts may
no longer submit simulated-gambling apps, and *either* this app contains such
content *or* the Ratings section declares that it does.

**It is the declaration, not the app.** Verified in the code on 2026-08-26:

- No loot boxes, gacha, lottery, jackpot, wagering or casino mechanics anywhere in
  `src/engine/**` or `src/content/**`.
- Every `Math.random` is an injectable RNG for *simulation* — market drift,
  ascension, puzzle generation — never a wagered payout.
- `src/engine/arbitrage.ts` and `src/engine/types.ts` both document that a futures
  **wager** was built and then deliberately removed for exactly this reason.
- `tests/arbitrage.test.ts` asserts it mechanically: *"has no stake at risk and no
  clock — ticking never touches the position."*

So the answer this doc has always prescribed — **Simulated Gambling → None** — was
right, and the questionnaire was filled in inconsistently with it. The Arbitrage
Desk is the feature most likely to have prompted a "yes"; the rationale for why it
is not a wager is in the Age rating section below, and is worth pasting into any
reply to App Review.

**The fix is metadata only — build 7 stands, no rebuild, no re-archive:**

1. App Information → Age Ratings → Edit → set the gambling question to **None**.
   The rating should fall from 13+ to 4+/9+.
2. Reply to the App Review message explaining the correction *and* the Arbitrage
   Desk. Do not resubmit silently — the same reviewer can reach the same conclusion.
3. Resubmit.

> **Do not "solve" this by adding a gambling disclosure.** Declaring content the app
> does not have is the mistake that caused this, and misdescribing content can pull a
> live app. If the desk ever gains a timer, a forced settlement, or a random payout,
> the honest answer changes and this account can no longer ship it at all.

---

## 1.0 was submitted on 2026-08-12

**Version 1.0, build 7.** Apple ID `6795242247`. Everything
below is done unless this box says otherwise; the checkboxes further down are left
as originally written because they are still the right order for a *next* app, not
because they are outstanding.

What shipped, and the parts that differ from what this doc predicted:

| Item | Shipped as |
|---|---|
| Availability | **148 countries — the 27 EU states are excluded** (see below) |
| Price | Free, no IAP, as planned |
| Age rating | 13+ — **wrong, and the cause of the rejection above.** Must become None-for-gambling |
| Privacy label | Usage Data → Advertising Data, not linked, **not** used for tracking |
| Category | Games / Simulation / Casual — see [ASO.md](ASO.md) §8, this doc's old guess was wrong |
| Build | 7, archived locally; Xcode Cloud has never shipped an artifact — see [NATIVE.md](NATIVE.md) |

**Why the EU is excluded.** The Digital Services Act requires a verified trader
declaration to distribute in the EU, and a trader's name, address, phone and email
are then **published on the EU product page**. The 27 EU states were dropped so v1
could ship without resolving that. The declaration was completed afterwards, so
re-adding them is now a metadata-only change: re-check the 27 boxes under Pricing
and Availability. **No new build and no new review.** The codes are the ISO alpha-3
set `AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT
NLD POL PRT ROU SVK SVN ESP SWE`.

> Norway, Iceland and Switzerland were **kept** — they are EEA/EFTA, not EU, and
> Apple's requirement as stated covers the EU. If Apple ever extends it to the EEA,
> Norway, Iceland and Liechtenstein are the ones to revisit.

**Two things this doc got wrong, recorded so the next pass doesn't repeat them:**

- The Privacy Policy URL lives under **App Privacy**, not on the version page.
  Phase 3 implies it sits with the other fields; it does not.
- The real gate was never the paperwork order — it was that `public/privacy.html`
  had no public host. Apple will not take a submission without a reachable policy
  URL, and that single unchecked line in Phase 1 blocked everything else.

---

## Phase 0 — Blockers

One down, two live. Both remaining ones are decisions, not work.

### ✅ Bundle the fonts — **DONE**

`index.html` used to load Cinzel, Spectral and JetBrains Mono from
`fonts.googleapis.com`, which was a real native defect: a first launch with no
signal rendered the entire game in Georgia, it undercut the offline story that
argues against Guideline 4.2, and it put a third-party request on every cold start
that the privacy policy (correctly) says we don't make.

Now self-hosted via `@fontsource/*`, imported in `src/main.tsx` — only the weights
the design uses, latin subset only (~200 KB of woff2).

**The non-obvious half:** bundling alone was not enough. `vite-plugin-pwa`'s default
`globPatterns` omits fonts, so the service worker never precached them and an
offline launch *still* fell back to Georgia. `vite.config.ts` now globs `woff2`
explicitly — precache went 9 → 22 entries. If you ever add a font weight, check the
precache count moves.

Verified: zero requests to `fonts.googleapis.com`/`gstatic.com`, all faces served
locally, and `document.fonts.check()` returns true for Cinzel 600, Spectral 400,
Spectral 500 italic and JetBrains Mono 700.

> Fontsource also emits legacy `.woff` next to each `.woff2`. Nothing we target
> requests them (the `@font-face` src lists woff2 first — confirmed in the network
> log), so they're inert weight in `dist/` and deliberately excluded from precache.
> Not worth hand-rolling `@font-face` rules to strip ~200 KB from the IPA.

### ⛔ Never sell Credits while the Arbitrage Desk exists

`PRODUCTS` reserves `creditsSmall` / `creditsLarge`. Selling Credits for real money
**and** letting players trade Credits against a randomly-moving market would make
this a real-money speculation loop — a regulated combination, whatever the desk is
called. The two features are individually fine and jointly a problem. If Credits
ever go on sale, the desk has to be re-examined first.

### ⛔ Ship v1 with no in-app purchases

`src/content/monetization.ts` defines three `PRODUCTS` ids. **Nothing in the UI
references them** (verified), so there are no dead buttons — good. Keep it that way:

- Do **not** create those products in App Store Connect for v1.
- Do **not** mention purchases in the listing.
- Answer "no" to in-app purchases in App Review notes.

A declared-but-nonfunctional purchase path is a Guideline 2.1 rejection. IAP is a
1.1 feature, once RevenueCat is actually wired.

### ✅ Name is available

`Electric Cats` confirmed free (26 Jul 2026), so the icon, screenshots and ASO copy
are safe to build on. **Still to do:** actually reserve it by creating the app record
as soon as enrolment clears — availability is not a hold, and the name is only locked
once the record exists.

---

## Phase 1 — Accounts and paperwork (start immediately; has lead time)

- ⬜ **Apple Developer Program**, $99/yr. Enrolment can take 24–48h and everything
  gates on it. Do this today.
- ⬜ **AdMob account** → create one rewarded unit for iOS, one for Android.
- ✅ Host the privacy + support pages — **done via GitHub Pages**
  (`.github/workflows/pages.yml`, deploys on any push to `main` that touches them):
  - `https://watcodes.github.io/game1/privacy.html`
  - `https://watcodes.github.io/game1/support.html`

  Both URLs are **mandatory** fields in App Store Connect. The Privacy Policy URL
  lives under **App Privacy**, not on the version page — easy to hunt for.

  The workflow publishes only these two pages plus a landing hub; it does **not**
  deploy `dist/`. Their cross-links were changed from root-relative (`/support.html`)
  to relative (`support.html`) because Pages serves the site from `/game1/`, where
  a root-relative href resolves to the wrong host path and 404s. Relative works
  both there and in the app build.
- ✅ Support email: **electriccatsofzeus@gmail.com**, used on both pages and to be
  entered as the App Store Connect support contact. Enable 2FA on it — the same
  address is the AdMob login, and that account holds the payment and tax details.

## Phase 2 — Flip the monetization switches (⬜ all)

In `src/content/monetization.ts`:

| Constant | Now | Change to |
|---|---|---|
| `APP_ID` | `com.watcodes.electriccats` | keep, or your real bundle id (must match `capacitor.config.ts`) |
| `ADS.rewardedIos` | ✅ real unit `…/9091279115` | done |
| `ADS.rewardedAndroid` | ✅ real unit `…/1096670800` | done |
| `ADS.testing` | `true` | **`false`, as the LAST step before archiving** |
| `ADS.nonPersonalized` | `true` | **leave `true`** — see below |

⚠️ **Flip `ADS.testing` last, not first.** The two mistakes are not symmetric:

- Real unit + `testing: true` → serves *test* ads. Harmless.
- Test unit + `testing: false` → sends test traffic to live inventory. **Suspension risk.**
- `testing: false` while you're still building → **you** see and may tap live ads on
  your own inventory. Also a suspension risk, and the easiest one to walk into.

So it stays `true` through development and TestFlight, and flips only in the commit
you archive from. `TEST_AD_UNITS` in `monetization.ts` backs this up: `ads.ts`
refuses to serve a known sample unit when `testing` is false, returning
`unavailable` — which still grants the player their reward. Forgetting fails safe.

**This is the very last code change before submitting.** One line, one commit:

```bash
# in src/content/monetization.ts, set  testing: false  — then:
npm run test && npm run build
```

Then confirm the dev console didn't ride along. It's gated on a bare
`import.meta.env.DEV`, which Vite folds to `false` at build time, so the whole
panel tree-shakes out — this should print nothing:

```bash
grep -r "Force-ascend to next tier" dist/assets/
```

It used to also accept `?dev` in the URL, which put free Credits, KP and
tier-skips in the shipped binary behind a five-character guess. If anyone
re-adds a *runtime* check, the code starts shipping again and this grep is how
you'd notice.

**Why `nonPersonalized` stays `true`:** personalized ads count as *tracking*, which
would require Apple's App Tracking Transparency prompt, an
`NSUserTrackingUsageDescription` string, and a "Data Used to Track You" declaration.
Most users decline ATT anyway, so the lost eCPM is smaller than it looks — and in
exchange there's no ATT prompt, no advertising identifier collected, and the privacy
answers below stay simple and true.

## Phase 3 — App Store Connect fields (⬜ all, before you touch Xcode)

Copy from [ASO.md](ASO.md): name, subtitle, keywords, promotional text, description,
category (Games → Simulation).

### App Privacy questionnaire

With `nonPersonalized: true` and no analytics SDK, the honest answers are:

| Question | Answer |
|---|---|
| Do you collect data from this app? | **Yes** — via the ad SDK only |
| Contact info / Health / Financial / Location / Contacts / User content / Search history / Browsing history | **Not collected** |
| Identifiers | **Not collected** (no IDFA — non-personalized) |
| Usage Data → Advertising Data | **Collected** · linked to identity: **No** · used for tracking: **No** · purpose: Third-Party Advertising |
| Diagnostics | **Not collected** (no crash SDK) |

Then: **"Data Used to Track You" → nothing.** That's the whole point of the
non-personalized decision.

> Re-verify against AdMob's current "data disclosure" page when you fill this in —
> Google publishes exactly what its SDK collects per configuration, and it changes.
> Getting this wrong is both a rejection and a compliance problem.

### Other fields

- **Age rating:** no violence, no user-generated content, no unrestricted web. Ads
  set the floor. **Simulated Gambling → None**, and the reasoning matters:

  > Apple defines simulated gambling as *wagering virtual currency on an outcome*,
  > and explicitly includes betting on races. A **futures desk** — stake Credits,
  > wait for a clock, win or lose on a price tick — would have qualified, whatever
  > it was called. It was built, then deliberately replaced.
  >
  > The shipped **Arbitrage Desk** is not a wager: you buy Watts into a battery and
  > choose when to sell them. There is **no stake at risk, no clock, and no forced
  > settlement** — you can hold indefinitely. The outcome follows from when the
  > player acts, not from a draw. That's the same category as selling crops at a
  > good price in a farming game.
  >
  > If the desk ever regains a timer, a forced settlement, or a random payout,
  > this answer has to change. Getting it wrong isn't just a rejection —
  > misdescribing content can pull a live app.

  **This answer was got wrong on the 1.0 submission and cost a rejection** (see the
  top of this file). Reply text for App Review, ready to paste:

  ```
  Thank you for the review. The gambling indication in the Ratings section was
  entered in error, and has been corrected to "None". Electric Cats contains no
  gambling or simulated gambling content.

  For clarity on the feature that may have prompted this: the app includes an
  "Arbitrage Desk", where the player buys in-game Watts into a battery at the
  current in-game price and chooses when to sell them. There is no stake at risk,
  no timer, and no forced settlement — the player can hold the stored Watts
  indefinitely, and the result follows entirely from when they choose to act
  rather than from any random draw or wagered outcome. It is mechanically the
  same as choosing when to sell crops in a farming game.

  The app has no loot boxes, no randomized rewards, no wagering of any in-game or
  real currency, and no in-app purchases of any kind. It is a single-player
  offline idle game.

  The rating has been updated and the app resubmitted for review.
  ```

  Consider adding a condensed version of the middle paragraph to the **App Review
  notes** permanently, so a future reviewer meets the explanation before forming a
  view of the desk.
- **Export compliance:** the app uses only standard HTTPS. Answer "uses encryption"
  → "only exempt encryption" (the standard OS-provided-HTTPS exemption). No ERN.
- **Sign-in required?** No. No accounts anywhere, so account-deletion rules don't
  apply.
- **App Review notes** — write these; they measurably reduce rejections:

  > Electric Cats is an offline single-player idle game. No account or login is
  > required and no server is involved — all progress is stored on-device. There are
  > no in-app purchases in this version. Rewarded video ads (Google AdMob,
  > non-personalized) are strictly optional and never required to progress; if an ad
  > fails to load the bonus is granted anyway. To see the optional ad placement,
  > send the app to the background for two minutes and reopen it — the "while you
  > were away" summary offers a ×2 reward video.

  The two minutes is `RESUME_SUMMARY_SECONDS`. Shorter absences still pay out, but
  as a toast instead of a modal, so an app-switch doesn't interrupt play. Keep the
  note and the constant in step: if that number rises, a reviewer following these
  words will background the app, see nothing, and file the ad feature as broken.

## Phase 4 — Device family: iPhone only for v1 (🍎 one checkbox)

The layout is `max-w-md` — on an iPad it's a narrow column in a field of parchment.
Reviewers **do** test on iPad, and poor iPad layout is a common rejection. Set the
target to iPhone only. Proper iPad support is a later release, not a launch blocker.

## Phase 5 — Native build (🍎)

Full detail in [NATIVE.md](NATIVE.md). Shape of it:

```bash
npm run native:install     # capacitor + status-bar + admob
npx cap init               # accepts values already in capacitor.config.ts
npx cap add ios
npm run native:ios         # build + sync + open Xcode
```

Then in Xcode: set the bundle id, pick your team for signing, set device family to
iPhone, and run on a **real device** — the simulator won't show you scroll feel or
ad behaviour.

### Icons and splash

```bash
npm run icons              # regenerates the PNG sources
npx @capacitor/assets generate \
  --iconBackgroundColor '#f3ead4' \
  --splashBackgroundColor '#f3ead4'
```

**Use `#f3ead4`, not the `#04070e` in older notes.** That dark value predates the
Marble & Gold redesign and would flash near-black on every launch — the same bug
already fixed in the PWA manifest and `capacitor.config.ts`.

### Guideline 4.2 "Minimum Functionality" — the main rejection risk

Any Capacitor app gets scrutinised for being a website in a shell. What already
argues against that: full offline play, on-device saves, native rewarded ads, no
browser chrome, and a native status bar. On the device, confirm:

- Long-press selects nothing and shows no copy/paste callout — *handled in CSS.*
- No rubber-band scroll revealing a blank page behind the UI — *`overscroll-behavior:
  none`, verify on device anyway.*
- Status bar glyphs are **dark** and readable over the parchment HUD — the meta tag
  and the `StatusBar` plugin config are both set for this; verify, because it's
  the one thing that looks obviously "web" when wrong.
- No white or dark flash on launch.

## Phase 6 — Ship

1. 🍎 Screenshots per the shot-list in ASO.md — **fresh tier-0 save**, largest
   iPhone simulator.
2. 🍎 Archive → upload → **TestFlight**. Install on your own phone from TestFlight
   and play a full session before submitting.
3. 🍎 Submit for review.

Expect **1–3 days**, and budget for one rejection — it's routine, not failure. Most
first-timer rejections are 4.2 (minimum functionality), 2.1 (something declared but
broken), or a privacy answer that doesn't match observed behaviour. All three are
addressed above.

---

## Not blocking launch, worth doing after

- IAP via RevenueCat (`@revenuecat/purchases-capacitor`) — handles receipt
  validation and restore on both stores.
- Android/Play Console ($25 once) — `codemagic.yaml` already has a working Android
  workflow that needs no Apple account.
- iPad layout, so the device restriction can be lifted.
- **The M7 balance pass.** Genuinely the highest-value work left: the first 30
  minutes decide reviews and retention, and `BASE_PRICE`, the three `UNLOCK_*`
  thresholds, `STAGE_DECOMMISSION` and `DEMAND_FRACTION` in `src/content/config.ts`
  are still estimates. A simulation already showed delivered power hard-caps at
  170 W/s around minute 10 at tier 0 — that's now signposted by an objective, but
  whether it *feels* right needs real play.
