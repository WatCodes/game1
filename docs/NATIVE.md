# Shipping Electric Cats as a native app

The web build in `dist/` **is** the app. Capacitor only wraps it in a native
shell, so nothing here changes how the game is written — and the PWA on Cloudflare
Pages keeps working exactly as it does today.

> **Submitting to the App Store?** Follow [APP_STORE.md](APP_STORE.md) — it's the
> ordered runbook (accounts, privacy answers, review notes, blockers). This file is
> the native-build reference it points at.

Nothing in `src/` imports a native SDK at build time. Plugins are loaded by name
at runtime (`src/platform/native.ts`), so:

- `npm run build` works today with none of the native packages installed,
- the web bundle never ships ad code,
- installing the packages later requires **no code change**.

---

## 1. What you need (only you can create these)

| Thing | Cost | Needed for |
|---|---|---|
| Apple Developer Program | $99/yr | iOS bundle id, signing, TestFlight, App Store |
| Google AdMob account | free | real rewarded-ad unit ids |
| Google Play Console | $25 once | Android release (skip if iOS-only) |
| A **Mac with Xcode** | — | iOS builds cannot be produced on Windows |

Android can be built on Windows with Android Studio. iOS cannot — that is an
Apple restriction, not a project one.

## 1b. You probably don't need to buy a Mac

`codemagic.yaml` builds both apps in CI. Codemagic's iOS machines **are** Macs,
so the pipeline runs `npx cap add ios` itself — the native shells are generated
per build and never committed (they're in `.gitignore`).

1. Sign in at [codemagic.io](https://codemagic.io) with GitHub, add `WatCodes/game1`.
2. It picks up `codemagic.yaml` automatically. Run the **Android** workflow first —
   it needs no accounts at all and produces a sideloadable debug APK.
3. For iOS: Codemagic UI → *Teams → Integrations → App Store Connect*, add your
   API key, then uncomment the `ios_signing` / `integrations` block in
   `codemagic.yaml`. Until then the iOS workflow fails at signing **by design**;
   everything before that step still verifies.

Both workflows run typecheck, lint and the test suite before building, so a
broken build never reaches a device.

> **This has now happened for iOS.** `ios/` is committed, because
> `App/App/Info.plist` carries the AdMob `GADApplicationIdentifier` by hand and a
> fresh `cap add ios` would not recreate it. `android/` is still gitignored and
> still generated per build.

## 1c. Xcode Cloud — the third CI, and the one that actually matters

There is also an **Xcode Cloud** workflow (`App | Default | Archive - iOS`),
configured in App Store Connect rather than in this repo. It triggers on pushes
and archives straight to TestFlight.

**Why it's worth preferring over the local Mac:** Xcode Cloud runs on Apple's
own machines with a current Xcode. The Mac this was set up on is a 2018 Intel
MacBook Pro, which tops out at **Xcode 26.3** — Xcode 26.4+ requires macOS Tahoe
26.2, which Intel cannot run. Since Apple has required the iOS 26 SDK for all
App Store uploads since 2026-04-28, that machine is roughly one release cycle
from being unable to ship at all. Xcode Cloud has no such ceiling.

**The catch, and why `ci_scripts/` exists:** Xcode Cloud clones the repo and runs
`xcodebuild` directly — it never runs npm. But the iOS shell uses Swift Package
Manager, and `ios/App/CapApp-SPM/Package.swift` references the Capacitor plugins
by relative path into `node_modules/`, which is gitignored. Without a hook the
build fails before compiling anything:

```
Could not resolve package dependencies: the package at
'/Volumes/workspace/repository/node_modules/@capacitor/status-bar'
cannot be accessed (... doesn't exist in file system)
```

`ci_scripts/ci_post_clone.sh` fixes this: installs Node, `npm ci`, `npm run
build`, `npx cap sync ios`. It is the Xcode Cloud equivalent of the dependency
and web-build steps `codemagic.yaml` performs for Codemagic.

> The script is duplicated at `ios/App/ci_scripts/ci_post_clone.sh`, which
> forwards to the root copy. Xcode Cloud looks for `ci_scripts/` either at the
> repository root or beside the Xcode project, and the documentation on which is
> ambiguous. Once a build log shows which one fired, delete the other.

**Three CI systems now exist** — Codemagic, Xcode Cloud, and Cloudflare Workers
for the web build. Only the last is verified green. Worth consolidating.

## 2. One-time setup (only if building locally)

```bash
npm run native:install     # capacitor core/cli/ios/android + admob plugin
npx cap add android        # on Windows or Mac
npx cap add ios            # Mac only (needs CocoaPods)
```

> ⚠️ **Do not run `npx cap init`.** That command's job is to *create*
> `capacitor.config.ts`, and this repo already has one carrying the parchment
> `backgroundColor`, the `contentInset` and the StatusBar style. Re-initialising
> can overwrite it (and emit a `.json` instead), silently undoing the fix for the
> near-black launch flash. `cap add` reads the existing config and is all you need.

`capacitor.config.ts` is deliberately untyped and imports nothing, so it can sit
in the repo without `@capacitor/cli` being a dependency. Once the packages are
installed you can add the type back if you want:

```ts
import type { CapacitorConfig } from '@capacitor/cli';
```

## 3. Swap the placeholder ids

Everything to change lives in **`src/content/monetization.ts`**:

| Constant | Currently | Change to |
|---|---|---|
| `APP_ID` | `com.watcodes.electriccats` | keep, or your real bundle id (must match `capacitor.config.ts`) |
| `ADS.rewardedIos` / `rewardedAndroid` | ✅ real AdMob units, both platforms | done |
| `ADS.testing` | `true` | **`false`**, in the commit you archive from — not before |
| `ADS.nonPersonalized` | `true` | **leave `true`** — personalized ads would require an ATT prompt (see APP_STORE.md) |
| `PRODUCTS.*` | placeholder skus | **nothing for v1** — ship without IAP; a declared-but-unbuilt purchase path is a 2.1 rejection |

> ⚠️ `ADS.testing` and the unit ids must move together. Serving **real** ads with
> `testing: true`, or **test** ads in production, is the classic way to get an
> AdMob account suspended.

### App ID vs ad unit ID — they are different things

AdMob hands out two shapes of identifier and mixing them up breaks the build in
two different ways:

| | Looks like | Where it goes |
|---|---|---|
| **App ID** | `ca-app-pub-…**~**5611430610` (tilde) | the **native manifest**, below |
| **Ad unit ID** | `ca-app-pub-…**/**1712485313` (slash) | `ADS.rewardedIos` / `rewardedAndroid` |

The real App IDs are recorded in `ADMOB_APP_ID` in `src/content/monetization.ts`.
No TypeScript reads them — the Google SDK loads them from the native manifests,
and **it throws on launch if they are missing**, so this is a crash-on-open bug
rather than a "no ads" bug. Once the native shells exist:

**iOS** — `ios/App/App/Info.plist`:

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-2102762899981380~5611430610</string>
```

**Android** — `android/app/src/main/AndroidManifest.xml`, inside `<application>`:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-2102762899981380~1867892655"/>
```

This is the point where generating the native shells per build stops being
enough — once these are edited, commit `ios/` and `android/`.

## 4. Build and run

```bash
npm run native:android     # build + sync + open Android Studio
npm run native:ios         # build + sync + open Xcode (Mac only)
```

`native:sync` runs `npm run build` first — Capacitor copies whatever is in
`dist/`, so a stale build ships stale code. Re-run it after every change.

## 5. How ads behave

Rewarded only, by design — no interstitials, nothing that interrupts play. The
single placement today is the **×2 away-earnings bonus** in the welcome-back
modal.

The grant rule lives in `shouldGrantReward` (`src/platform/ads.ts`) and is unit
tested:

- watched it → grant
- **ads unavailable** (web/PWA, plugin missing, no fill, offline) → **grant anyway**
- dismissed it early → withhold

A player on the browser build must never be worse off than one on native. Only a
deliberate early dismissal withholds the bonus, so an ad failure can never block
progression.

## 6. Still to do when the accounts exist

- IAP is scaffolded as ids only. The purchase flow itself is not built — the
  usual choice is RevenueCat (`@revenuecat/purchases-capacitor`), which handles
  receipt validation and restore on both stores.
- **App icons / splash — sources already exist.** `npm run icons` regenerates
  them all from `scripts/make-icons.mjs` (no image dependencies; it encodes the
  PNGs itself). It writes `public/icon-192|512|1024.png` and
  `public/splash-2732.png`. The 192/512 are what the PWA already uses; the 1024
  and 2732 are the sources `@capacitor/assets` expands into every native size:

  ```bash
  npx @capacitor/assets generate --iconBackgroundColor '#f3ead4' --splashBackgroundColor '#f3ead4'
  ```

  Parchment (`#f3ead4`), **not** the `#04070e` these notes used before the Marble &
  Gold redesign — that dark value flashed near-black on every launch.

  Edit the geometry at the top of the script (head circle, ear triangles, bolt
  polygon) rather than hand-editing PNGs, so every size stays in sync.
- ASO: title, subtitle, keywords, screenshots. Take screenshots on a fresh save
  so the **Athens** tier-0 world and the intro are what people see.
