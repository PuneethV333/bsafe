import { useState } from 'react';
import type { AlertStatus } from '@bsafe/shared-types';
import { useAdminAlerts, useAdminReports, useRetryAlert } from '../../lib/admin';
import { StatusPill } from '../../components/StatusPill';

function fmt(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function fmtMinutes(m?: number | null): string {
  if (m == null) return '—';
  return `${Math.round(m)}m`;
}

export function AdminDashboard() {
  const [status, setStatus] = useState<'' | AlertStatus>('');
  const alerts = useAdminAlerts(status ? { status } : {});
  const reports = useAdminReports();

  const maxDay = Math.max(1, ...(reports.data?.alertsPerDay.map((d) => d.count) ?? [1]));

  return (
    <div className="mx-auto max-w-6xl animate-rise">
      <header>
        <p className="eyebrow">Operations · read only</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-chalk">
          Alert overview
        </h1>
      </header>

      <main className="mt-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Total alerts" value={String(reports.data?.totals.alerts ?? '…')} />
          <Metric
            label="Active (24h)"
            value={String(reports.data?.activeNow ?? '…')}
            accent={Boolean(reports.data?.activeNow)}
          />
          <Metric label="Ack rate" value={reports.data ? `${Math.round(reports.data.ackRate * 100)}%` : '…'} />
          <Metric label="Avg to ack" value={fmtMinutes(reports.data?.avgAcknowledgeMinutes)} />
          <Metric label="Avg to resolve" value={fmtMinutes(reports.data?.avgResolveMinutes)} />
        </section>

        <section className="mt-4 rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-chalk">Alerts per day</h2>
            <span className="font-mono text-[11px] text-faint">LAST 30 DAYS</span>
          </div>
          <div
            role="img"
            aria-label="Bar chart of alerts per day over the last 30 days"
            className="mt-4 flex h-28 items-end gap-1 border-b border-line pb-px"
          >
            {(reports.data?.alertsPerDay ?? []).map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.count} alert${d.count === 1 ? '' : 's'}`}
                className="flex flex-1 flex-col justify-end"
              >
                <div
                  className="min-h-[4px] rounded-t-sm bg-gradient-to-t from-signal/40 to-signal/80 transition-[height] duration-300 hover:to-signal"
                  style={{ height: `${Math.max(4, Math.round((d.count / maxDay) * 100))}%` }}
                />
              </div>
            ))}
          </div>
          {reports.data && reports.data.alertsPerDay.length === 0 && (
            <p className="mt-3 font-mono text-xs text-faint">No alerts recorded yet.</p>
          )}
        </section>

        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-chalk">All alerts</h2>
            <label className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-mist">
              <span>STATUS</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as '' | AlertStatus)}
                className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-chalk outline-none transition-colors focus:border-signal"
              >
                <option value="">All statuses</option>
                <option value="sent">Active</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
          </div>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-raised/60 font-mono text-[11px] uppercase tracking-wider text-faint">
                <tr>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Triggered</th>
                  <th className="px-4 py-3 font-medium">Acknowledged</th>
                  <th className="px-4 py-3 font-medium">Resolved</th>
                  <th className="px-4 py-3 font-medium">Locs</th>
                  <th className="px-4 py-3 font-medium">Delivered</th>
                  <th className="px-4 py-3 font-medium">Retry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {alerts.data?.map((a) => (
                  <tr key={a.id} className="bg-panel transition-colors hover:bg-raised/50">
                    <td className="px-4 py-3">
                      <StatusPill status={a.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-chalk">{a.userName}</div>
                      {a.userEmail && <div className="font-mono text-[11px] text-faint">{a.userEmail}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-mist">{fmt(a.triggeredAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-mist">{fmt(a.acknowledgedAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-mist">{fmt(a.resolvedAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-mist">{a.locationCount}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <span className="text-safe-soft">{a.deliveriesSent}</span>
                      {a.deliveriesFailed > 0 && (
                        <span className="ml-1.5 text-signal-soft">{a.deliveriesFailed} failed</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.deliveriesFailed > 0 ? (
                        <RetryButton alertId={a.id} />
                      ) : (
                        <span className="font-mono text-xs text-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {alerts.data && alerts.data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="bg-panel px-4 py-10 text-center font-mono text-xs text-faint">
                      No alerts match this filter.
                    </td>
                  </tr>
                )}
                {alerts.isLoading && (
                  <tr>
                    <td colSpan={8} className="bg-panel px-4 py-10 text-center font-mono text-xs text-faint">
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? 'border-signal/50 bg-signal/10' : 'border-line bg-panel'
      }`}
    >
      <div className="font-mono text-[11px] uppercase tracking-wider text-faint">{label}</div>
      <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-chalk">{value}</div>
    </div>
  );
}

function RetryButton({ alertId }: { alertId: string }) {
  const retry = useRetryAlert(alertId);
  return (
    <button
      onClick={() => retry.mutate()}
      disabled={retry.isPending}
      className="rounded-lg border border-signal/50 px-2.5 py-1.5 font-mono text-[11px] font-medium text-signal-soft transition-colors hover:bg-signal/10 disabled:opacity-60"
    >
      {retry.isPending ? '…' : retry.isSuccess ? `Requeued ${retry.data.requeued}` : 'Retry'}
    </button>
  );
}
