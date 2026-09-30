import { useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { formatShort } from '../../engine/format';
import { CurrencyCard, type CardAnchor, type CurrencyId } from './CurrencyCard';

function Chip({
  label,
  value,
  rate,
  tone,
  active,
  onTap,
}: {
  label: string;
  value: string;
  rate?: string;
  tone: string;
  active: boolean;
  onTap: () => void;
}) {
  return (
    // A button, not a span: players asked what these mean, and tapping the
    // thing you are confused by is the first thing anyone tries.
    <button
      className={`flex items-center gap-1.5 rounded border px-2 py-0.5 transition-colors ${
        active ? 'border-volt bg-raised' : 'border-line bg-raised/60 hover:bg-raised'
      }`}
      onClick={onTap}
      aria-expanded={active}
      aria-label={`${label}: ${value}. What is this?`}
    >
      <span className="text-[9px] uppercase tracking-wider text-ink-dim">{label}</span>
      <span className={tone}>{value}</span>
      {rate && <span className="text-[10px] text-ink-dim">{rate}</span>}
    </button>
  );
}

export function ResourceBar() {
  const rp = useGame((s) => s.display.rp);
  const rpRate = useGame((s) => s.display.rpRate);
  const kp = useGame((s) => s.display.kp);
  const prestige = useGame((s) => s.display.prestige);
  const credits = useGame((s) => s.display.credits);
  const [open, setOpen] = useState<CurrencyId | null>(null);
  const [anchor, setAnchor] = useState<CardAnchor | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const toggle = (id: CurrencyId) => {
    // Measured on open: the card is portalled out of the header, so it needs the
    // bar's on-screen position rather than inheriting it.
    const r = bar.current?.getBoundingClientRect();
    if (r) setAnchor({ top: r.bottom, left: r.left, width: r.width });
    setOpen((cur) => (cur === id ? null : id));
  };

  return (
    <div ref={bar} className="relative flex items-center justify-between gap-1.5 border-b border-line/60 bg-transparent px-3 py-1.5 font-mono text-xs">
      <Chip label="RP" value={formatShort(Math.floor(rp))} rate={`+${rpRate.toFixed(2)}/s`} tone="text-current" active={open === 'rp'} onTap={() => toggle('rp')} />
      <Chip label="CR" value={formatShort(Math.floor(credits))} tone="text-volt" active={open === 'cr'} onTap={() => toggle('cr')} />
      <Chip label="KP" value={formatShort(kp)} rate={`×${prestige.toFixed(2)}`} tone="text-ascend" active={open === 'kp'} onTap={() => toggle('kp')} />
      {open && anchor && <CurrencyCard id={open} anchor={anchor} onClose={() => setOpen(null)} />}
    </div>
  );
}
