import { useState } from 'react';
import { audioEnabled, setAudioEnabled } from '../audio';

/**
 * The mute button used to live in the world viewport's corner. That component
 * is gone, and a phone game with no reachable mute is a phone game people close
 * — so it now floats on the left edge, mirroring the right rail's buttons.
 */
export function SoundToggle() {
  const [on, setOn] = useState(audioEnabled);
  const toggle = () => {
    setAudioEnabled(!on);
    setOn(!on);
  };
  return (
    <button
      className="pointer-events-auto absolute left-3 top-[46%] z-20 flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-95"
      style={{
        background: 'var(--bg-panel)',
        border: '1.5px solid var(--grid-line)',
        color: on ? 'var(--amber)' : 'var(--text-dim)',
        boxShadow: '0 4px 10px rgba(0,0,0,.15)',
      }}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Mute audio' : 'Enable audio'}
    >
      <span className="font-mono text-[13px] leading-none">{on ? '♪' : '♪̸'}</span>
    </button>
  );
}
