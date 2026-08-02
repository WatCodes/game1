import { useState } from 'react';
import { HELP_SECTIONS } from '../../content/help';

/**
 * The Field Manual — a reference the player can reach at any time.
 *
 * Accordion rather than one long scroll: nine systems of flat prose is a wall,
 * and someone opening this is looking for one answer, not a read. Everything
 * starts collapsed so the list of titles doubles as a table of contents.
 */
export function HelpPanel() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 px-4 py-3.5">
      <p className="text-center font-body text-[11.5px] italic text-ink-dim">
        Nothing here is a secret — it is all discoverable in play. This is just faster.
      </p>

      {HELP_SECTIONS.map((s) => {
        const isOpen = open === s.id;
        return (
          <div key={s.id} className="rounded-xl border border-line bg-raised">
            <button
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
              onClick={() => setOpen(isOpen ? null : s.id)}
              aria-expanded={isOpen}
            >
              <span className="font-display text-[12.5px] font-semibold">{s.title}</span>
              <span className="font-mono text-[11px] text-ink-dim" aria-hidden>
                {isOpen ? '−' : '+'}
              </span>
            </button>
            {isOpen && (
              <div className="flex flex-col gap-2 px-3.5 pb-3">
                {s.body.map((p, i) => (
                  <p key={i} className="font-body text-[11.5px] leading-relaxed text-ink-dim">
                    {p}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
