# Mac day — agent runbook

**Audience: an agent working on Wyatt's Mac, with no prior context.** Follow this
top to bottom. It is self-contained: every id and value you need is inline.

Goal: turn this repo into a signed iOS build, uploaded to App Store Connect and
submitted for review, as **Electric Cats** — an offline single-player idle game
(Vite + React + TypeScript, wrapped by Capacitor).

Phases marked **🧑 HUMAN** need Wyatt at the keyboard (Xcode GUI, a physical
device, Apple's web UI). Do everything else yourself, and *stop at each
checkpoint* rather than pushing past a failure.

---

## Ground rules — read before touching anything

1. **Never run `npx cap init`.** Its job is to *create* `capacitor.config.ts`.
   One already exists, carrying the parchment `backgroundColor` (`#f3ead4`), the
   `contentInset` and the StatusBar style. Re-initialising can overwrite it and
   silently restore a near-black flash on every launch, which reads as a crash.
   `npx cap add ios` reads the existing config and is all that's needed.

2. **Do not flip `ADS.testing` until Phase 8**, and confirm with Wyatt first.
   Real ad units with `testing: true` serve harmless test ads. Test traffic sent
   to live inventory, *or* Wyatt viewing live ads on his own inventory during
   development, is how AdMob accounts get suspended. It flips once, in the commit
   that gets archived, and never earlier.

3. **The AdMob ids in this repo are not secrets.** App IDs and ad unit IDs ship
   inside every published app and are readable by anyone. Do not treat them as
   credentials or try to move them into env vars.

4. **Change nothing in `src/engine/**` or `src/content/**`** except the single
   `ADS.testing` line in Phase 8. Balance and save-format changes are out of
   scope for shipping day.

5. **If the test suite is not green, stop and report.** Do not "fix" a failing
   test to proceed — it means the Mac is building something different from what
   was verified, and that is the finding.

6. Commit as you go with clear messages, and push. Never force-push.

---

## Phase 0 — Preflight

Freshly installed Xcode leaves two landmines that fail confusingly much later.

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

`xcode-select` frequently still points at the bare Command Line Tools, and
CocoaPods then cannot find the SDKs. Any command-line build refuses silently
until the licence is accepted.

```bash
xcodebuild -version && node -v && pod --version && df -h /
```

**Checkpoint.** All four must succeed:

- **Xcode** — report the version. It must be recent enough for the current App
  Store SDK minimum (Apple raises this each spring; an upload built with too old
  an SDK is rejected at submission, after all the signing work). If it looks old,
  say so before continuing.
- **Node** — 20 or newer.
- **pod** — if missing: `brew install cocoapods`.
- **Disk** — Xcode plus the iOS platform wants ~40 GB free.

---

## Phase 1 — Clone and prove the code is healthy

```bash
git clone https://github.com/WatCodes/game1.git
cd game1
npm install
npm test
```

**Checkpoint: the suite must be fully green (currently 215 tests, 17 files).**

This is the single most valuable check in the runbook. If it passes, the Mac is
building exactly the code that was verified on Windows, and any later failure is
native configuration rather than the game. If it fails, stop and report the
output verbatim.

---

## Phase 2 — Generate the iOS shell

```bash
npm run native:install
npx cap add ios
```

`native:install` adds Capacitor core/cli/ios/android, the status-bar plugin and
the AdMob plugin. `cap add ios` scaffolds `ios/` and runs `pod install`.

This is the step most likely to complain — `pod install` hits the CocoaPods CDN,
so a stale pod cache or a network hiccup surfaces here. If pods fail:

```bash
pod repo update && cd ios/App && pod install && cd ../..
```

**Checkpoint:** `ios/App/App.xcworkspace` exists. Note the *workspace*, not the
`.xcodeproj` — with CocoaPods, opening the bare project produces link errors.

---

## Phase 3 — The AdMob App ID (crash-preventer)

**The Google SDK throws on launch if this key is absent.** This is a
crash-on-open bug, not a "no ads" bug, so it is worth doing carefully.

```bash
/usr/libexec/PlistBuddy -c "Add :GADApplicationIdentifier string ca-app-pub-2102762899981380~5611430610" ios/App/App/Info.plist
```

Verify it landed:

```bash
/usr/libexec/PlistBuddy -c "Print :GADApplicationIdentifier" ios/App/App/Info.plist
```

**It must print `ca-app-pub-2102762899981380~5611430610`.**

Note the **`~`**. AdMob issues two shapes of identifier and they are not
interchangeable: `~` marks an *App* ID and belongs here in the native manifest;
`/` marks an *ad unit* ID and belongs in `src/content/monetization.ts` (already
done — do not touch it). Pasting a `/` id here fails at runtime, not build time.

> If PlistBuddy reports the key already exists, print it and confirm the value
> matches before moving on.

---

## Phase 4 — Project settings you can do without the GUI

### iPhone only

The layout is `max-w-md`; on an iPad it renders as a narrow column in a field of
parchment. Reviewers do test on iPad and poor iPad layout is a common rejection.
Proper iPad support is a later release, not a launch blocker.

```bash
sed -i '' 's/TARGETED_DEVICE_FAMILY = "1,2"/TARGETED_DEVICE_FAMILY = "1"/g' ios/App/App.xcodeproj/project.pbxproj
grep -n "TARGETED_DEVICE_FAMILY" ios/App/App.xcodeproj/project.pbxproj
```

**Checkpoint:** every occurrence now reads `"1"`. If the file already said `"1"`,
nothing to do.

### Bundle identifier

Capacitor takes this from `appId` in `capacitor.config.ts`. Verify rather than
edit:

```bash
grep -n "PRODUCT_BUNDLE_IDENTIFIER" ios/App/App.xcodeproj/project.pbxproj
```

**Expected: `com.watcodes.electriccats`.** It must match both
`capacitor.config.ts` and the app record in App Store Connect. If it differs,
stop and report — do not guess.

---

## Phase 5 — Commit the native shell

`ios/` and `android/` are gitignored because they are normally generated per
build. Phase 3 hand-edited `Info.plist`, so `ios/` must now be committed or that
key is lost on the next clean checkout.

Remove **only** the `ios/` line from `.gitignore` (leave `android/` ignored —
there is no hand-edited Android config yet), then:

```bash
git add -A
git commit -m "Add the iOS native shell with the AdMob App ID"
git push origin main
```

**Checkpoint:** `git status` is clean and `ios/App/App/Info.plist` is tracked.

---

## Phase 6 — 🧑 HUMAN: signing and a real device

```bash
npx cap open ios
```

Wyatt, in Xcode, with the **App** target selected:

1. **Signing & Capabilities** → tick *Automatically manage signing* → pick your
   Team. This is where first-timers lose the most time; if it complains about
   provisioning, the usual fix is that the bundle id isn't registered yet, and
   letting Xcode register it resolves it.
2. **General → Deployment Info** → confirm iPhone is the only device family
   (Phase 4 should have set this).
3. Plug in an iPhone, select it as the destination, and **Run**.

Use a real device, not the simulator — the simulator won't show you scroll feel,
safe-area behaviour, or ad loading.

**On-device checks** (these are the Guideline 4.2 "is this just a website"
risks, and all four are already handled in code — you are confirming, not
fixing):

- No white or dark flash on launch; it should come up parchment.
- Status bar glyphs are **dark** and readable over the light HUD.
- Long-press selects nothing and shows no copy/paste callout.
- No rubber-band scroll revealing blank space behind the UI.

Then play for a few minutes and confirm the game itself works: buy sources, open
the sheet, check the Dispatch Board slider moves.

**Verify the away flow, which is where the only ad lives:** background the app
(home gesture), wait **two minutes**, reopen. You should get the "while you were
away" summary with a ×2 watch button. Under two minutes you'll get a small toast
instead — that's intended. Report what you see; this is the exact flow named in
the App Review notes.

---

## Phase 7 — 🧑 HUMAN: screenshots

Take them from a **fresh tier-0 save** so the Athens courtyard and the intro are
what shoppers see — not a late-game grid that means nothing to a new player.

**Export the real save first if there's progress worth keeping** (in-game:
ASCEND → Data → export), because you'll want a clean slate for the shots.

The shot list and listing copy are in `docs/ASO.md`.

---

## Phase 8 — The archive commit

**Confirm with Wyatt before doing this.** Only proceed once TestFlight testing is
done, because after this the build serves *live* ads.

Recommended order, and worth explaining if asked: TestFlight the build with
`testing: true` first. Test ads are safe to tap repeatedly while verifying the
flow. Flip to `false` only for the build actually submitted. Backwards means
Wyatt is generating impressions on his own live inventory.

In `src/content/monetization.ts`, change exactly one line:

```
  testing: true,   →   testing: false,
```

Then:

```bash
npm run test && npm run build
```

Confirm the dev console did not ride along. It's gated on a bare
`import.meta.env.DEV`, which Vite folds to `false` at build time so the whole
panel tree-shakes out. **This must print nothing:**

```bash
grep -r "Force-ascend to next tier" dist/assets/
```

If it prints a match, stop — a cheat panel is about to ship. Then:

```bash
npx cap sync ios
git add -A
git commit -m "Ship build: real ads live"
git push origin main
```

`cap sync` matters: Capacitor copies whatever is in `dist/`, so skipping it
archives the *previous* web build.

---

## Phase 9 — 🧑 HUMAN: archive, upload, submit

In Xcode: **Product → Archive** → Distribute App → App Store Connect → Upload.

Then in App Store Connect: attach the build, confirm the metadata is complete,
and submit for review.

Expect **1–3 days**, and budget for one rejection — it's routine, not failure.
The common first-timer rejections are 4.2 (minimum functionality), 2.1
(something declared but broken), and privacy answers that don't match observed
behaviour. All three are addressed in `docs/APP_STORE.md`.

---

## Report back

When you stop — finished or blocked — tell Wyatt:

1. Which phase you reached.
2. The Xcode version from Phase 0 and the test count from Phase 1.
3. That `GADApplicationIdentifier` printed the expected `~` value.
4. Whether `TARGETED_DEVICE_FAMILY` is `"1"`.
5. Any command that failed, with output verbatim — do not summarise errors.
6. What you did **not** do, especially if `ADS.testing` is still `true`.

---

## Troubleshooting

**`pod install` fails or hangs** — `pod repo update` first; the CDN spec mirror
goes stale. If CocoaPods itself is missing, `brew install cocoapods`.

**"Command PhaseScriptExecution failed"** — usually `dist/` is missing or stale.
Run `npm run build && npx cap sync ios`.

**Xcode can't find the SDK / weird toolchain errors** — `xcode-select` is
pointing at Command Line Tools. Re-run Phase 0.

**Signing: "No profiles found"** — the bundle id isn't registered to the team
yet. Let Xcode register it via *Automatically manage signing*.

**App launches then immediately dies** — first suspect is a missing or malformed
`GADApplicationIdentifier`. Re-run the Phase 3 verify.

**Upload rejected for SDK version** — Xcode is too old for the current minimum.
No workaround; it needs a newer Xcode, which may need a newer macOS.

**Everything is red and nothing makes sense** — `rm -rf ios && npx cap add ios`
regenerates the shell, then **redo Phase 3 and Phase 4**, which are the two
hand-edits that get destroyed by that.
