import { nativePlugin, platformName } from './native';
import { CONFIG } from '../content/config';
import type { LeaderboardScores } from '../engine/leaderboards';

/**
 * Game Center, through the app's own Swift plugin (ios/App/App/GameCenterPlugin.swift).
 * Design: docs/GAME_CENTER.md.
 *
 * Every call is fire-and-forget and degrades to nothing: the web build, Android,
 * a player who declines sign-in, and a leaderboard not yet set up in App Store
 * Connect all look the same from here — scores just don't go anywhere. Nothing
 * in the game waits on Game Center or changes because of it.
 */

interface GameCenterPlugin {
  authenticate(): Promise<{ authenticated: boolean }>;
  submitScore(options: { leaderboardId: string; score: number }): Promise<void>;
  showLeaderboards(): Promise<void>;
}

// Resolved once: Capacitor's registerPlugin warns on every repeat registration
// of the same name, and this is reached from the autosave interval.
let cached: GameCenterPlugin | null | undefined;
const plugin = (): GameCenterPlugin | null =>
  (cached ??= platformName() === 'ios' ? nativePlugin<GameCenterPlugin>('GameCenter') : null);

export const gameCenterAvailable = (): boolean => plugin() !== null;

const AUTH_TIMEOUT_MS = 15_000;
let authenticated = false;
let authenticating: Promise<boolean> | null = null;

/**
 * Sign in. Safe to call repeatedly: one request is ever in flight, and GameKit
 * itself only shows its sheet once per launch — a player who dismisses it is
 * not asked again until the next launch.
 *
 * Bounded by a timeout because GameKit is not obliged to answer: on a device
 * that can't reach Game Center (or an app it doesn't recognise yet) the native
 * handler may never fire, and the Leaderboards button awaits this.
 */
export function authenticateGameCenter(): Promise<boolean> {
  const gc = plugin();
  if (!gc) return Promise.resolve(false);
  if (authenticated) return Promise.resolve(true);
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), AUTH_TIMEOUT_MS));
  authenticating ??= Promise.race([
    gc.authenticate().then((r) => (authenticated = r.authenticated)),
    timeout,
  ])
    .catch(() => false)
    .finally(() => {
      authenticating = null;
    });
  return authenticating;
}

// The best score each board has already been sent this install, so an
// unchanged score is never resent. UI storage, not the save: it describes this
// device's conversation with Game Center, not the game.
const SENT_KEY = 'kardashev:ui:gc-sent';

function readSent(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function writeSent(sent: Record<string, number>): void {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(sent));
  } catch {
    // Worst case a score is resent next time. Game Center keeps the best anyway.
  }
}

let lastSubmit = 0;

/**
 * Post any score that has improved. Throttled to GAME_CENTER_SUBMIT_INTERVAL_MS
 * unless `force` (backgrounding — the moment a session's best is final).
 */
export function submitScores(scores: LeaderboardScores, force = false): void {
  const gc = plugin();
  if (!gc || !authenticated) return;
  const now = Date.now();
  if (!force && now - lastSubmit < CONFIG.GAME_CENTER_SUBMIT_INTERVAL_MS) return;
  lastSubmit = now;
  const sent = readSent();
  for (const [leaderboardId, score] of Object.entries(scores)) {
    if (score <= 0 || score <= (sent[leaderboardId] ?? 0)) continue;
    gc.submitScore({ leaderboardId, score })
      .then(() => {
        const latest = readSent();
        latest[leaderboardId] = Math.max(latest[leaderboardId] ?? 0, score);
        writeSent(latest);
      })
      .catch(() => {
        // Not set up in App Store Connect yet, or offline. Retried next window.
      });
  }
}

/** Open Apple's leaderboard screen, signing in first if needed. False if that failed. */
export async function showLeaderboards(): Promise<boolean> {
  const gc = plugin();
  if (!gc) return false;
  if (!(await authenticateGameCenter())) return false;
  try {
    await gc.showLeaderboards();
    return true;
  } catch {
    return false;
  }
}
