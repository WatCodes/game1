import { useState } from 'react';
import { useGameTick } from './hooks/useGameTick';
import { useGame } from '../store/gameStore';
import { formatTime } from '../engine/format';
import { PowerMeter } from './components/PowerMeter';
import { ResourceBar } from './components/ResourceBar';
import { SourcesPanel } from './components/SourcesPanel';
import { ResearchTree } from './components/ResearchTree';
import { MegaprojectPanel } from './components/MegaprojectPanel';
import { AscendPanel } from './components/AscendPanel';
import { DataControls } from './components/DataControls';
import { Tabs, type TabId } from './components/Tabs';
import { Toasts } from './components/Toasts';
import { OfflineModal } from './components/OfflineModal';

function DispatchBar() {
  const readyIn = useGame((s) => s.display.dispatchReadyIn);
  const doDispatch = useGame((s) => s.actions.doDispatch);
  const ready = readyIn <= 0;

  return (
    <div className="border-t border-line bg-panel px-3 py-2">
      <button
        className={`w-full rounded border py-2 font-mono text-xs uppercase tracking-widest transition-colors ${
          ready
            ? 'border-volt text-volt hover:bg-volt/10'
            : 'border-line text-ink-dim cursor-not-allowed'
        }`}
        disabled={!ready}
        onClick={doDispatch}
      >
        {ready ? '⚡ Dispatch — surge the grid' : `Dispatch ready in ${formatTime(readyIn)}`}
      </button>
    </div>
  );
}

export default function App() {
  useGameTick();
  const [tab, setTab] = useState<TabId>('sources');
  const canAscend = useGame((s) => s.display.ascend.can);

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col">
      <header className="shrink-0">
        <PowerMeter />
        <ResourceBar />
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'sources' && <SourcesPanel />}
        {tab === 'research' && <ResearchTree />}
        {tab === 'megaproject' && <MegaprojectPanel />}
        {tab === 'ascend' && (
          <>
            <AscendPanel />
            <div className="px-3 pb-3">
              <DataControls />
            </div>
          </>
        )}
      </main>

      <footer className="shrink-0">
        <DispatchBar />
        <Tabs active={tab} onSelect={setTab} badges={{ ascend: canAscend }} />
      </footer>

      <Toasts />
      <OfflineModal />
    </div>
  );
}
