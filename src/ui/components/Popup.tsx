import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The pop-up pattern (design 2b): the courtyard keeps living underneath, dimmed
 * by a scrim, while a parchment panel floats over it. Every feature opens this
 * way instead of taking over the screen as a tab — that's what keeps the game
 * feeling like a place rather than a stack of menus.
 */
export function Popup({
  title,
  icon,
  meta,
  onClose,
  children,
}: {
  title: string;
  icon?: ReactNode;
  meta?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col" role="dialog" aria-modal="true" aria-label={title}>
      {/* Scrim — tapping it closes, but the courtyard stays visible behind. */}
      <button
        className="absolute inset-0 cursor-default"
        style={{ background: 'var(--scrim)' }}
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      <div
        className="relative mx-4 mb-3 mt-[132px] flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-line"
        style={{ background: 'var(--bg-panel)', boxShadow: '0 20px 50px rgba(0,0,0,.35)' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-[18px] py-3.5">
          <span className="flex items-center gap-2.5">
            {icon}
            <span className="font-display text-[15px] font-semibold" style={{ letterSpacing: '.08em' }}>
              {title}
            </span>
          </span>
          <span className="flex items-center gap-2.5">
            {meta}
            <button
              ref={closeRef}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-line font-mono text-sm text-ink-dim transition-colors hover:text-ink"
              onClick={onClose}
              aria-label={`Close ${title}`}
            >
              ×
            </button>
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
