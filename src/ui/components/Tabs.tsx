export type TabId = 'sources' | 'research' | 'megaproject' | 'ascend';

const TABS: { id: TabId; label: string }[] = [
  { id: 'sources', label: 'Sources' },
  { id: 'research', label: 'Research' },
  { id: 'megaproject', label: 'Project' },
  { id: 'ascend', label: 'Ascend' },
];

export function Tabs({
  active,
  onSelect,
  badges,
}: {
  active: TabId;
  onSelect: (id: TabId) => void;
  badges?: Partial<Record<TabId, boolean>>;
}) {
  return (
    <nav className="grid grid-cols-4 border-t border-line bg-panel" aria-label="Game sections">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`relative py-2.5 text-xs uppercase tracking-wider transition-colors ${
            active === t.id ? 'text-current' : 'text-ink-dim hover:text-ink'
          }`}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
          {badges?.[t.id] && (
            <span
              className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-ascend"
              style={{ boxShadow: '0 0 6px var(--violet-glow)' }}
              aria-label="attention"
            />
          )}
          {active === t.id && (
            <span className="absolute inset-x-3 bottom-0 h-0.5 bg-current" style={{ boxShadow: '0 0 8px var(--cyan-glow)' }} />
          )}
        </button>
      ))}
    </nav>
  );
}
