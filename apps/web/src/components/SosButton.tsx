import { useRef } from 'react';
import type { TriggerType } from '@bsafe/shared-types';

const HOLD_MS = 600;

interface SosButtonProps {
  /** Fired on a single tap OR a 600ms long-press. */
  onTrigger: (type: TriggerType) => void;
  disabled?: boolean;
  /** After an alert is live the only feedback is the dial dimming — no sound, no modal. */
  active?: boolean;
}

const TICKS = Array.from({ length: 60 }, (_, i) => i);

/**
 * Silent SOS trigger, drawn as a sonar dial: a tick ring, a breathing hairline
 * while armed, and a solid signal core. Supports both a single tap and a
 * long-press (both fire the same alert). Feedback is intentionally minimal:
 * when an alert is live the whole dial dims and goes still. No sound, no modal,
 * no success animation.
 */
export function SosButton({ onTrigger, disabled = false, active = false }: SosButtonProps) {
  const suppressTap = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const firing = useRef(false);

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
      fire('longPress');
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
    fire('tap');
  };

  const fire = (type: TriggerType) => {
    // Latch: one trigger per press even if click/pointer/keyboard events overlap.
    if (firing.current) return;
    firing.current = true;
    window.setTimeout(() => {
      firing.current = false;
    }, 350);
    onTrigger(type);
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
      disabled={disabled}
      className={[
        'group relative flex h-60 w-60 select-none items-center justify-center rounded-full outline-none sm:h-72 sm:w-72',
        'focus-visible:ring-4 focus-visible:ring-signal/40',
        disabled && !active ? 'cursor-not-allowed' : '',
      ].join(' ')}
    >
      {/* Instrument tick ring */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className={`absolute inset-0 h-full w-full ${active ? 'text-faint/30' : 'text-faint'}`}
      >
        {TICKS.map((i) => {
          const major = i % 5 === 0;
          const angle = (i * 6 * Math.PI) / 180;
          const r1 = major ? 43 : 44.75;
          const r2 = 48.5;
          return (
            <line
              key={i}
              x1={50 + r1 * Math.sin(angle)}
              y1={50 - r1 * Math.cos(angle)}
              x2={50 + r2 * Math.sin(angle)}
              y2={50 - r2 * Math.cos(angle)}
              stroke="currentColor"
              strokeWidth={major ? 1 : 0.6}
            />
          );
        })}
      </svg>

      {/* Breathing standby ring — goes still while an alert is live */}
      <span
        aria-hidden
        className={[
          'absolute inset-[13%] rounded-full border',
          active ? 'border-signal/15' : 'border-signal/35 animate-breathe',
        ].join(' ')}
      />

      {/* Core */}
      <span
        aria-hidden
        className={[
          'absolute inset-[19%] rounded-full ring-1 ring-inset transition-all duration-200',
          active
            ? 'bg-signal-dim text-mist/50 ring-signal/20'
            : disabled
              ? 'bg-raised text-faint ring-line'
              : 'bg-gradient-to-b from-signal-bright to-signal text-white ring-white/25 shadow-[0_18px_60px_-16px_rgba(225,45,74,0.6)] group-hover:shadow-[0_22px_70px_-14px_rgba(225,45,74,0.75)] group-active:scale-[0.98]',
        ].join(' ')}
      />

      <span className="relative flex flex-col items-center gap-2">
        <span
          className={[
            'font-display text-4xl font-bold tracking-[0.24em] pl-[0.24em] sm:text-5xl',
            active ? 'text-mist/50' : disabled ? 'text-faint' : 'text-white',
          ].join(' ')}
        >
          SOS
        </span>
        <span
          className={[
            'font-mono text-[10px] tracking-[0.24em]',
            active ? 'text-mist/40' : disabled ? 'text-faint' : 'text-white/70',
          ].join(' ')}
        >
          {active ? 'TRANSMITTING' : disabled ? 'STANDBY' : 'TAP · HOLD'}
        </span>
      </span>
    </button>
  );
}
