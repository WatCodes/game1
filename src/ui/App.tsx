import { useEffect, useState } from 'react';
import { useGameTick } from './hooks/useGameTick';
import { useGame } from '../store/gameStore';
import { prime, setHum } from './audio';
import { initAds } from '../platform/ads';
import { PowerMeter } from './components/PowerMeter';
import { ResourceBar } from './components/ResourceBar';
import { SourcesPanel } from './components/SourcesPanel';
import { ResearchGraph } from './components/ResearchGraph';
import { MegaprojectPanel } from './components/MegaprojectPanel';
import { PuzzlePanel } from './components/PuzzlePanel';
import { ShopPanel } from './components/ShopPanel';
import { AscendPanel } from './components/AscendPanel';
import { DataControls } from './components/DataControls';
import { AchievementsList } from './components/AchievementsList';
import { BugReport } from './components/BugReport';
import { CheatPanel } from './components/CheatPanel';
import { Toasts } from './components/Toasts';
import { OfflineModal } from './components/OfflineModal';
import { AscensionOverlay } from './components/AscensionOverlay';
import { IntroOverlay } from './components/IntroOverlay';
import { ObjectiveStrip } from './components/ObjectiveStrip';
import { Courtyard } from './components/Courtyard';
import { Popup } from './components/Popup';
import { RightRail, type RailId } from './components/RightRail';
import { SoundToggle } from './components/SoundToggle';
import { HelpButton } from './components/HelpButton';
import { HelpPanel } from './components/HelpPanel';
import { StrandedBanner } from './components/StrandedBanner';

const TITLES: Record<RailId, string> = {
  lab: 'THE LAB',
  wonder: 'THE WONDER',
  works: 'THE WORKS',
  agora: 'THE AGORA',
  ascend: 'ASCEND',
};

/**
 * The home screen IS the courtyard (design 2a). The HUD floats over it, the
 * right rail opens features as pop-ups (2b) rather than swapping full-screen
 * tabs, and the source list lives in a bottom sheet that peeks and expands.
 */
export default function App() {
  useGameTick();
  const [popup, setPopup] = useState<RailId | null>(null);
  // Help is its own flag rather than another RailId: it is not a game system,
  // it has no rail button, and widening RailId would put it in the badge and
  // title maps where it does not belong.
  const [helpOpen, setHelpOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const canAscend = useGame((s) => s.display.ascend.can);
  const dailyReady = useGame((s) => s.display.shop.canClaimDaily);
  const pps = useGame((s) => s.display.pps);
  const offline = useGame((s) => s.offline);
  const cinematic = useGame((s) => s.cinematic);
  const modalOpen = !!offline || !!cinematic;

  useEffect(() => {
    const start = () => prime();
    window.addEventListener('pointerdown', start, { once: true });
    return () => window.removeEventListener('pointerdown', start);
  }, []);

  // Start the ad SDK at launch, not at the first ad. It reports ready before it
  // actually is, so requesting a load moments after starting it fails on real
  // hardware — see initAds(). No-ops off native.
  useEffect(() => {
    initAds();
  }, []);
  useEffect(() => setHum(pps), [pps]);

  return (
    <div className="relative mx-auto h-dvh max-w-md overflow-hidden">
      <div className="contents" {...(modalOpen ? { inert: '' } : {})}>
        {/* The world, always rendered and always animating. */}
        <Courtyard />

        {/* Top HUD — floats on a scrim so the courtyard reads behind it. */}
        <header
          className="safe-top pointer-events-none absolute inset-x-0 top-0 z-20"
          // The HUD used to fade out from 55%, which was fine over Athens's pale
          // sky and illegible over the night ages — the courtyard bled straight
          // through the readouts. It now stays solid and fades only at the very
          // bottom edge, into the same parchment rather than into grey.
          style={{ background: 'linear-gradient(var(--bg) 96%, rgba(243,234,212,0))' }}
        >
          <div className="pointer-events-auto">
            <PowerMeter />
            <ResourceBar />
            <ObjectiveStrip />
            {/* Only shows when output is actually being thrown away, and is
                itself the route to the fix — the Transmission lanes live inside
                the sources sheet, which is collapsed by default. */}
            <StrandedBanner
              onOpen={() => {
                setPopup(null);
                setSheetOpen(true);
              }}
            />
          </div>
        </header>

        <SoundToggle />
        <HelpButton
          onOpen={() => {
            setPopup(null); // never stack two panels
            setHelpOpen(true);
          }}
        />

        <RightRail
          active={popup}
          onSelect={(id) => setPopup((cur) => (cur === id ? null : id))}
          badges={{ ascend: canAscend, agora: dailyReady }}
        />

        {/* Bottom sheet: peek shows the header, tap to expand the full list. */}
        {!popup && !helpOpen && (
          <div
            className="absolute inset-x-0 bottom-0 z-20 rounded-t-[20px] border-t border-line"
            style={{
              background: 'var(--bg-panel)',
              boxShadow: '0 -8px 24px rgba(0,0,0,.12)',
              maxHeight: sheetOpen ? '68%' : undefined,
            }}
          >
            <button
              className="safe-bottom flex w-full flex-col items-center gap-1.5 px-4 pb-1 pt-2"
              onClick={() => setSheetOpen((v) => !v)}
              aria-expanded={sheetOpen}
            >
              <span className="h-1 w-[38px] rounded-full" style={{ background: 'var(--grid-line)' }} />
              <span className="flex w-full items-center justify-between">
                <span className="font-display text-xs font-semibold" style={{ letterSpacing: '.1em' }}>
                  POWER SOURCES
                </span>
                <span className="font-mono text-[9px] text-ink-dim">{sheetOpen ? 'SWIPE DOWN ⌄' : 'SWIPE UP ⌃'}</span>
              </span>
            </button>
            {sheetOpen && (
              <div className="max-h-[calc(68vh-56px)] overflow-y-auto pb-3">
                <SourcesPanel />
              </div>
            )}
          </div>
        )}

        {helpOpen && (
          <Popup title="FIELD MANUAL" onClose={() => setHelpOpen(false)}>
            <HelpPanel />
          </Popup>
        )}

        {popup && (
          <Popup title={TITLES[popup]} onClose={() => setPopup(null)}>
            {popup === 'lab' && (
              <div className="h-[60vh]">
                <ResearchGraph />
              </div>
            )}
            {popup === 'wonder' && <MegaprojectPanel />}
            {popup === 'works' && <PuzzlePanel />}
            {popup === 'agora' && <ShopPanel />}
            {popup === 'ascend' && (
              <>
                <AscendPanel />
                <div className="flex flex-col gap-2 px-3 pb-3">
                  <AchievementsList />
                  <DataControls />
                  <BugReport />
                  <CheatPanel />
                </div>
              </>
            )}
          </Popup>
        )}
      </div>

      <Toasts />
      <OfflineModal />
      <AscensionOverlay />
      <IntroOverlay />
    </div>
  );
}
