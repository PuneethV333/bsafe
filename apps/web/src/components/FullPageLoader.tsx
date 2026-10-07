import { SosMark } from './icons';

interface FullPageLoaderProps {
  /** Mono label under the brand mark, e.g. "SYNCING…". */
  label?: string;
}

/**
 * Full-screen loading state. Used wherever a route has to wait on auth/sync
 * before it can decide what to render — a bare empty div reads as a broken
 * screen, so this keeps the night palette and signals that work is in flight.
 */
export function FullPageLoader({ label = 'SYNCING…' }: FullPageLoaderProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-night text-mist">
      <div className="flex flex-col items-center gap-3">
        <SosMark className="h-3 w-20 animate-breathe text-signal" />
        <span className="font-display text-lg font-bold tracking-tight text-chalk">
          bSafe
        </span>
      </div>

      <div className="flex items-center gap-3 font-mono text-xs tracking-widest">
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-signal"
        />
        {label}
      </div>
    </div>
  );
}