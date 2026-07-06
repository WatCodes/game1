import { useState } from 'react';
import { useGameTick } from './hooks/useGameTick';
import { useGame } from '../store/gameStore';
import { PowerMeter } from './components/PowerMeter';
import { ResourceBar } from './components/ResourceBar';
import { SourcesPanel } from './components/SourcesPanel';
import { ResearchTree } from './components/ResearchTree';
import { MegaprojectPanel } from './components/MegaprojectPanel';
import { PuzzlePanel } from './components/PuzzlePanel';
import { ShopPanel } from './components/ShopPanel';
import { AscendPanel } from './components/AscendPanel';
import { DataControls } from './components/DataControls';
import { AchievementsList } from './components/AchievementsList';
import { Tabs, type TabId } from './components/Tabs';
import { Toasts } from './components/Toasts';
import { OfflineModal } from './components/OfflineModal';
import { WorldViewport } from './components/WorldViewport';
import { AscensionOverlay } from './components/AscensionOverlay';

function DispatchBar() {
  const dispatch = useGame((s) => s.display.dispatch);
  const doDispatch = useGame((s) => s.actions.doDispatch);
  const pct = Math.floor(dispatch.charge * 100);

  return (
    <div className="border-t border-line bg-panel px-3 py-2">
      <button
        className={`relative w-full overflow-hidden rounded border py-2 font-mono text-xs uppercase tracking-widest transition-colors ${
          dispatch.peakActive
            ? 'dispatch-peak border-ascend text-ascend'
            : dispatch.charge >= 1
              ? 'dispatch-ready border-volt text-volt hover:bg-volt/10'
              : dispatch.canFire
                ? 'border-volt text-volt hover:bg-volt/10'
                : 'border-line text-ink-dim cursor-not-allowed'
        }`}
        disabled={!dispatch.canFire}
        onClick={doDispatch}
        aria-label={`Dispatch, ${pct}% charged${dispatch.peakActive ? ', peak demand active' : ''}`}
      >
        {/* charge fill behind the label */}
        <span
          className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${
            dispatch.peakActive ? 'bg-ascend/15' : 'bg-volt/10'
          }`}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
        <span className="relative">
          {dispatch.peakActive
            ? `⚡ PEAK ×3 — fire now! (${Math.ceil(dispatch.peakLeft)}s)`
            : dispatch.canFire
              ? `⚡ Dispatch — ${pct}% charge`
              : `Dispatch charging — ${pct}%`}
        </span>
      </button>
    </div>
  );
}

export default function App() {
  useGameTick();
  const [tab, setTab] = useState<TabId>('sources');
  const canAscend = useGame((s) => s.display.ascend.can);
  const dailyReady = useGame((s) => s.display.shop.canClaimDaily);

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col">
      <header className="shrink-0">
        <PowerMeter />
        <ResourceBar />
        <WorldViewport />
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'sources' && <SourcesPanel />}
        {tab === 'research' && <ResearchTree />}
        {tab === 'megaproject' && <MegaprojectPanel />}
        {tab === 'puzzle' && <PuzzlePanel />}
        {tab === 'shop' && <ShopPanel />}
        {tab === 'ascend' && (
          <>
            <AscendPanel />
            <div className="flex flex-col gap-2 px-3 pb-3">
              <AchievementsList />
              <DataControls />
            </div>
          </>
        )}
      </main>

      <footer className="shrink-0">
        <DispatchBar />
        <Tabs active={tab} onSelect={setTab} badges={{ ascend: canAscend, shop: dailyReady }} />
      </footer>

      <Toasts />
      <OfflineModal />
      <AscensionOverlay />
    </div>
  );
}
