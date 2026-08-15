import type { AlertStatus } from '@bsafe/shared-types';

const STATUS_STYLES: Record<AlertStatus, string> = {
  sent: 'bg-red-600 text-white',
  acknowledged: 'bg-amber-500 text-slate-900',
  resolved: 'bg-slate-700 text-slate-200',
};

const STATUS_LABELS: Record<AlertStatus, string> = {
  sent: 'ACTIVE',
  acknowledged: 'ACKNOWLEDGED',
  resolved: 'RESOLVED',
};

export function StatusPill({ status }: { status: AlertStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wider ${STATUS_STYLES[status]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABELS[status]}
    </span>
  );
}