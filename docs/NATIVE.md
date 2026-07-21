# Shipping Electric Cats as a native app

The web build in `dist/` **is** the app. Capacitor only wraps it in a native
shell, so nothing here changes how the game is written — and the PWA on Netlify
keeps working exactly as it does today.

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

## 2. One-time setup

```bash
npm run native:install     # capacitor core/cli/ios/android + admob plugin
npx cap init               # accepts the values already in capacitor.config.ts
npx cap add android        # on Windows or Mac
npx cap add ios            # Mac only
```

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
| `APP_ID` | `com.watcodes.electriccats` | your real bundle id (must match `capacitor.config.ts`) |
| `ADS.rewardedIos` / `rewardedAndroid` | Google's public **test** unit ids | your real AdMob unit ids |
| `ADS.testing` | `true` | **`false`** before submitting |
| `PRODUCTS.*` | placeholder skus | the product ids you create in App Store Connect / Play Console |

> ⚠️ `ADS.testing` and the unit ids must move together. Serving **real** ads with
> `testing: true`, or **test** ads in production, is the classic way to get an
> AdMob account suspended.

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
- App icons and splash screens (`@capacitor/assets` generates every size from
  one source image).
- ASO: title, subtitle, keywords, screenshots. Take screenshots on a fresh save
  so the **Athens** tier-0 world and the intro are what people see.
