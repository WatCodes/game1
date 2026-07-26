# App Store submission runbook

Ordered so that everything not needing a Mac happens first. Listing copy lives in
[ASO.md](ASO.md); native build mechanics in [NATIVE.md](NATIVE.md).

**Legend:** ⬜ doable on Windows now · 🍎 needs the Mac · ⛔ blocker

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
- ⬜ Host the privacy + support pages. They're already written and ship with the web
  build as `public/privacy.html` and `public/support.html`, so they're live at:
  - `https://<your-site>/privacy.html`
  - `https://<your-site>/support.html`

  Both URLs are **mandatory** fields in App Store Connect.
- ✅ Support email: **electriccatsofzeus@gmail.com**, used on both pages and to be
  entered as the App Store Connect support contact. Enable 2FA on it — the same
  address is the AdMob login, and that account holds the payment and tax details.

## Phase 2 — Flip the monetization switches (⬜ all)

In `src/content/monetization.ts`:

| Constant | Now | Change to |
|---|---|---|
| `APP_ID` | `com.watcodes.electriccats` | keep, or your real bundle id (must match `capacitor.config.ts`) |
| `ADS.rewardedIos` / `rewardedAndroid` | Google's public **test** units | your real AdMob unit ids |
| `ADS.testing` | `true` | **`false`** |
| `ADS.nonPersonalized` | `true` | **leave `true`** — see below |

⚠️ **`ADS.testing` and the unit ids move together.** Real units with `testing: true`,
or test units in production, is the classic way to get an AdMob account suspended.

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

- **Age rating:** answer honestly — no violence, no gambling (the market price is not
  a wager), no user-generated content, no unrestricted web. Ads set the floor.
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
  > close the app for a minute and reopen it — the "while you were away" summary
  > offers a ×2 reward video.

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
