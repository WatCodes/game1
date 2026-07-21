import { useGame } from '../../store/gameStore';

/**
 * One line, always answering "what now?". Idle games lose people in the first
 * session to directionlessness more than to shallowness.
 */
export function ObjectiveStrip() {
  const objective = useGame((s) => s.display.objective);
  if (!objective) return null;

  return (
    <div
      className="flex items-center gap-2 border-b border-line/60 px-3 py-1.5"
      role="status"
      aria-live="polite"
    >
      <span className="text-[9px] uppercase tracking-wider text-ink-dim">next</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-ink">{objective.text}</span>
    </div>
  );
}
