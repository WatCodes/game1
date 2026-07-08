import { useEffect } from 'react';
import { useGame, type Toast } from '../../store/gameStore';
import { blip } from '../audio';

const KIND_STYLE: Record<Toast['kind'], string> = {
  milestone: 'border-volt-dim text-volt',
  research: 'border-current-dim text-current',
  stage: 'border-current-dim text-current',
  ascend: 'border-ascend text-ascend',
  info: 'border-line text-ink',
  error: 'border-danger text-danger',
};

function ToastCard({ toast }: { toast: Toast }) {
  const dismissToast = useGame((s) => s.actions.dismissToast);

  useEffect(() => {
    blip(toast.kind);
    const t = setTimeout(() => dismissToast(toast.id), 4000);
    return () => clearTimeout(t);
  }, [toast.id, toast.kind, dismissToast]);

  return (
    <button
      className={`toast-enter glass-deep pointer-events-auto w-full rounded-lg border px-3 py-2 text-left text-xs ${KIND_STYLE[toast.kind]}`}
      onClick={() => dismissToast(toast.id)}
    >
      {toast.text}
    </button>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    // Anchored above the footer (dispatch + tabs) + iOS safe area, so toasts
    // never cover the power meter or the interactive bottom bar.
    <div
      className="pointer-events-none fixed inset-x-0 z-30 mx-auto flex w-full max-w-sm flex-col gap-1.5 px-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6.75rem)' }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}
