import type { ReactNode } from 'react';

export type RailId = 'lab' | 'wonder' | 'works' | 'agora' | 'ascend';

/** Icon glyphs are CSS shapes, as in the mockup — no icon font, no SVG deps. */
const ICONS: Record<RailId, ReactNode> = {
  lab: <span className="h-[11px] w-[11px] rotate-45 bg-current" />,
  wonder: (
    <span
      className="h-0 w-0"
      style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '13px solid currentColor' }}
    />
  ),
  works: <span className="h-3.5 w-3.5 rounded-full border-[2.5px] border-current" />,
  agora: <span className="h-[11px] w-[13px] rounded-sm border-2 border-current" />,
  ascend: (
    <span
      className="h-0 w-0"
      style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '11px solid currentColor' }}
    />
  ),
};

const LABELS: Record<RailId, string> = {
  lab: 'LAB',
  wonder: 'WONDER',
  works: 'WORKS',
  agora: 'AGORA',
  ascend: 'ASCEND',
};

/**
 * Floating right rail (design 2a) — replaces the bottom tab bar. Buttons sit
 * over the courtyard rather than boxing it in, which is most of why the
 * redesign feels like a place instead of an app.
 */
export function RightRail({
  active,
  onSelect,
  badges,
}: {
  active: RailId | null;
  onSelect: (id: RailId) => void;
  badges?: Partial<Record<RailId, boolean>>;
}) {
  const order: RailId[] = ['lab', 'wonder', 'works', 'agora', 'ascend'];
  return (
    <div className="pointer-events-auto absolute right-3 top-[46%] z-20 flex flex-col gap-[11px]">
      {order.map((id) => {
        const isActive = active === id;
        const accent = id === 'ascend' ? 'var(--danger)' : id === 'lab' ? 'var(--amber)' : 'var(--grid-line)';
        return (
          <button
            key={id}
            className="relative flex h-[50px] w-[50px] flex-col items-center justify-center gap-[3px] rounded-full transition-all active:scale-95"
            style={{
              background: isActive ? 'var(--amber)' : 'var(--bg-panel)',
              border: `1.5px solid ${isActive ? 'var(--amber)' : accent}`,
              color: isActive ? '#fff' : id === 'ascend' ? 'var(--danger)' : id === 'lab' ? 'var(--amber)' : 'var(--text-dim)',
              boxShadow: isActive ? '0 0 16px rgba(184,137,47,.6)' : '0 4px 10px rgba(0,0,0,.15)',
            }}
            onClick={() => onSelect(id)}
            aria-pressed={isActive}
          >
            {badges?.[id] && !isActive && (
              <span
                className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--danger)' }}
              />
            )}
            {ICONS[id]}
            <span className="font-display text-[7px] font-semibold">{LABELS[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
