import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--bg-panel)',
        raised: 'var(--bg-raised)',
        line: 'var(--grid-line)',
        current: 'var(--cyan)',
        'current-dim': 'var(--cyan-dim)',
        volt: 'var(--amber)',
        'volt-dim': 'var(--amber-dim)',
        ascend: 'var(--violet)',
        ink: 'var(--text)',
        'ink-dim': 'var(--text-dim)',
        ok: 'var(--ok)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        mono: 'var(--font-mono)',
        display: 'var(--font-display)',
      },
    },
  },
  plugins: [],
} satisfies Config;
