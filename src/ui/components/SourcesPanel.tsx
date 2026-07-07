import { useGame } from '../../store/gameStore';
import { SourceRow } from './SourceRow';
import { GridPanel } from './GridPanel';

export function SourcesPanel() {
  const sources = useGame((s) => s.display.sources);
  const power = useGame((s) => s.display.power);

  return (
    <div className="flex flex-col gap-2 p-3">
      <GridPanel />
      {sources.map((src) => (
        <SourceRow key={src.id} src={src} power={power} />
      ))}
    </div>
  );
}
