import { useState } from 'react';
import { gameCenterAvailable, showLeaderboards } from '../../platform/gameCenter';

/**
 * Opens Apple's leaderboard screen. iOS only — absent on the web and Android,
 * where there is nothing to open. Docs: docs/GAME_CENTER.md.
 */
export function LeaderboardsButton() {
  const [failed, setFailed] = useState(false);
  if (!gameCenterAvailable()) return null;

  return (
    <div className="rounded border border-line bg-panel/60 p-3">
      <button
        className="w-full rounded-lg border py-2 font-mono text-[11px] font-semibold"
        style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
        onClick={() => {
          setFailed(false);
          void showLeaderboards().then((ok) => setFailed(!ok));
        }}
      >
        ◆ LEADERBOARDS
      </button>
      {failed && (
        <p className="mt-1.5 text-center font-body text-[10.5px] italic text-ink-dim">
          Game Center isn&rsquo;t signed in. Sign in under Settings → Game Center, then try again.
        </p>
      )}
    </div>
  );
}
