import { useGame, type ResearchView } from '../../store/gameStore';
import { formatShort } from '../../engine/format';

function ResearchNodeCard({ node }: { node: ResearchView }) {
  const buyResearchNode = useGame((s) => s.actions.buyResearchNode);

  if (node.purchased) {
    return (
      <div className="rounded border border-line bg-panel/60 px-3 py-2 opacity-70">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-ok">✓ {node.name}</span>
          <span className="font-mono text-[11px] text-ink-dim">T{node.tier}</span>
        </div>
        <p className="text-xs text-ink-dim">{node.desc}</p>
      </div>
    );
  }

  const blocked = node.missingPrereqs.length > 0;
  const buyable = node.available && node.affordable;

  return (
    <div className={`rounded border px-3 py-2 ${node.available ? 'border-current-dim bg-panel' : 'border-line bg-panel/50'}`}>
      <div className="flex items-baseline justify-between text-sm">
        <span className={`font-semibold ${node.available ? '' : 'text-ink-dim'}`}>{node.name}</span>
        <span className="font-mono text-[11px] text-ink-dim">T{node.tier}</span>
      </div>
      <p className="text-xs text-ink-dim">{node.desc}</p>
      {blocked ? (
        <p className="mt-1 text-[11px] text-ink-dim">Requires: {node.missingPrereqs.join(', ')}</p>
      ) : (
        <button
          className={`mt-1.5 rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
            buyable
              ? 'border-current-dim text-current hover:bg-raised'
              : 'border-line text-ink-dim cursor-not-allowed'
          }`}
          disabled={!buyable}
          onClick={() => buyResearchNode(node.id)}
        >
          Research — {formatShort(node.cost)} RP
        </button>
      )}
    </div>
  );
}

export function ResearchTree() {
  const research = useGame((s) => s.display.research);
  const open = research.filter((n) => !n.purchased);
  const done = research.filter((n) => n.purchased);

  return (
    <div className="flex flex-col gap-2 p-3">
      {open.length === 0 && (
        <p className="px-1 text-sm text-ink-dim">All current research complete. Ascend to reach the next tier.</p>
      )}
      {open.map((n) => (
        <ResearchNodeCard key={n.id} node={n} />
      ))}
      {done.length > 0 && (
        <>
          <div className="mt-2 px-1 text-[11px] uppercase tracking-widest text-ink-dim">Completed</div>
          {done.map((n) => (
            <ResearchNodeCard key={n.id} node={n} />
          ))}
        </>
      )}
    </div>
  );
}
