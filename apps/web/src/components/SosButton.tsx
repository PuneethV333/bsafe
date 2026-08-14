import { useRef } from 'react';
import type { TriggerType } from '@bsafe/shared-types';

const HOLD_MS = 600;

interface SosButtonProps {
  /** Fired on a single tap OR a 600ms long-press. */
  onTrigger: (type: TriggerType) => void;
  disabled?: boolean;
  /** After an alert is live the only feedback is the button dimming — no sound, no modal. */
  active?: boolean;
}

/**
 * Silent SOS trigger. Supports both a single tap and a long-press (both fire
 * the same alert). Feedback is intentionally minimal: the button dims and the
 * ring fades. No sound, no modal, no success animation.
 */
export function SosButton({ onTrigger, disabled = false, active = false }: SosButtonProps) {
  const suppressTap = useRef(false);
  const holdTimer = useRef<number | null>(null);

  const cancelHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const handlePointerDown = () => {
    if (disabled || active) return;
    suppressTap.current = false;
    holdTimer.current = window.setTimeout(() => {
      suppressTap.current = true;
      onTrigger('longPress');
    }, HOLD_MS);
  };

  const handlePointerUp = () => {
    cancelHold();
  };

  const handleClick = () => {
    if (disabled || active) return;
    if (suppressTap.current) {
      suppressTap.current = false;
      return;
    }
    onTrigger('tap');
  };

  return (
    <button
      type="button"
      aria-label="Trigger SOS"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled && !active) onTrigger('tap');
      }}
      disabled={disabled}
      className={[
        'relative flex h-44 w-44 items-center justify-center rounded-full text-xl font-bold',
        'outline-none focus-visible:ring-4 focus-visible:ring-red-500/50 select-none',
        active
          ? 'bg-red-900/60 text-red-200/70'
          : disabled
            ? 'cursor-not-allowed bg-slate-800 text-slate-500'
            : 'bg-red-600 text-white shadow-[0_0_40px_rgba(239,68,68,0.35)] hover:bg-red-500',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'absolute inset-0 rounded-full border-4',
          active ? 'border-red-700/40' : 'border-red-400/30',
        ].join(' ')}
      />
      SOS
    </button>
  );
}