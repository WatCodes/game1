import { useGame } from '../../store/gameStore';
import { SourceRow } from './SourceRow';
import { GridPanel } from './GridPanel';
import { TierTwistPanel } from './TierTwistPanel';
import { DispatchBoard } from './DispatchBoard';

export function SourcesPanel() {
  const sources = useGame((s) => s.display.sources);
  const credits = useGame((s) => s.display.credits);
  // Progressive disclosure: the game opens as just "buy a thing", and each
  // system slots in above the sources as it comes online.
  const unlocks = useGame((s) => s.display.unlocks);

  return (
    <div className="flex flex-col gap-2 p-3">
      {unlocks.board && <DispatchBoard />}
      {unlocks.transmission && <GridPanel />}
      <TierTwistPanel />
      {sources.map((src) => (
        <SourceRow key={src.id} src={src} credits={credits} />
      ))}
    </div>
  );
}
