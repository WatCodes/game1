export type TabId = 'sources' | 'research' | 'megaproject' | 'puzzle' | 'shop' | 'ascend';

const TABS: { id: TabId; label: string }[] = [
  { id: 'sources', label: 'Grid' },
  { id: 'research', label: 'Lab' },
  { id: 'megaproject', label: 'Project' },
  { id: 'puzzle', label: 'Works' },
  { id: 'shop', label: 'Shop' },
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
    <nav className="grid grid-cols-6 border-t border-line bg-panel" aria-label="Game sections">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`relative min-h-[44px] py-3 text-[10px] uppercase tracking-wide transition-colors ${
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
