import type { AlertStatus } from '@bsafe/shared-types';

const STATUS_STYLES: Record<AlertStatus, string> = {
  sent: 'border-signal/50 bg-signal/15 text-signal-soft',
  acknowledged: 'border-caution/40 bg-caution/10 text-caution',
  resolved: 'border-line bg-raised text-mist',
};

const STATUS_LABELS: Record<AlertStatus, string> = {
  sent: 'ACTIVE',
  acknowledged: 'ACKNOWLEDGED',
  resolved: 'RESOLVED',
};

export function StatusPill({ status }: { status: AlertStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium tracking-wider ${STATUS_STYLES[status]}`}
    >
      {status === 'sent' ? (
        <span aria-hidden className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-signal" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
        </span>
      ) : (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}
