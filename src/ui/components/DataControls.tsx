import { useState } from 'react';
import { useGame } from '../../store/gameStore';

/** Export / import / hard reset — lives at the bottom of the Ascend tab. */
export function DataControls() {
  const exportSaveString = useGame((s) => s.actions.exportSaveString);
  const importSaveString = useGame((s) => s.actions.importSaveString);
  const hardReset = useGame((s) => s.actions.hardReset);
  const [field, setField] = useState('');
  const [armReset, setArmReset] = useState(false);

  const btn = 'rounded border border-line px-2.5 py-1.5 text-[11px] text-ink-dim transition-colors hover:bg-raised hover:text-ink';

  return (
    <div className="mt-2 rounded border border-line bg-panel/60 p-3">
      <h3 className="text-[11px] uppercase tracking-widest text-ink-dim">Save data</h3>
      <textarea
        className="mt-2 h-16 w-full rounded border border-line bg-bg p-2 font-mono text-[10px] text-ink"
        placeholder="Paste a save string to import, or export to fill this box."
        value={field}
        onChange={(e) => setField(e.target.value)}
        aria-label="Save string"
      />
      <div className="mt-1.5 flex gap-1.5">
        <button className={btn} onClick={() => setField(exportSaveString())}>
          Export
        </button>
        <button
          className={btn}
          onClick={() => {
            if (importSaveString(field)) setField('');
          }}
        >
          Import
        </button>
        <span className="flex-1" />
        {armReset ? (
          <>
            <button className={`${btn} !border-danger !text-danger`} onClick={() => { hardReset(); setArmReset(false); }}>
              Really reset
            </button>
            <button className={btn} onClick={() => setArmReset(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className={btn} onClick={() => setArmReset(true)}>
            Hard reset
          </button>
        )}
      </div>
    </div>
  );
}
