import { useGame } from '../../store/gameStore';
import { SourceRow } from './SourceRow';
import { GridPanel } from './GridPanel';
import { TierTwistPanel } from './TierTwistPanel';
import { DispatchBoard } from './DispatchBoard';

export function SourcesPanel() {
  const sources = useGame((s) => s.display.sources);
  const credits = useGame((s) => s.display.credits);

  return (
    <div className="flex flex-col gap-2 p-3">
      <DispatchBoard />
      <GridPanel />
      <TierTwistPanel />
      {sources.map((src) => (
        <SourceRow key={src.id} src={src} credits={credits} />
      ))}
    </div>
  );
}
