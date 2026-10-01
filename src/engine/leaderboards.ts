import type { GameState } from './types';
import { CONFIG } from '../content/config';

/**
 * What this save would post to each Game Center leaderboard. Design:
 * docs/GAME_CENTER.md.
 *
 * Pure and integer-valued: Game Center scores are int64, and both boards are
 * set up in App Store Connect to read these integers back as the right thing
 * (whole KP, and a percentage with one decimal). A score of 0 means "nothing
 * to post yet" — nobody should appear on a board for having done nothing.
 */
export interface LeaderboardScores {
  [id: string]: number;
}

export function leaderboardScores(s: GameState): LeaderboardScores {
  const kp = Number.isFinite(s.kp) ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Math.max(0, s.kp))) : 0;
  const ret = Math.max(0, Math.min(CONFIG.LEADERBOARD_MAX_RETURN, s.desk.bestReturn));
  return {
    [CONFIG.LEADERBOARD_KP_ID]: kp,
    // 0.523 → 523 → shown as "52.3%"
    [CONFIG.LEADERBOARD_BEST_TRADE_ID]: Math.round(ret * 1000),
  };
}
