import { useState } from 'react';
import type { AlertStatus } from '@bsafe/shared-types';
import { useAdminAlerts, useAdminReports, useRetryAlert } from '../../lib/admin';
import { StatusPill } from '../../components/StatusPill';
import { ShieldIcon } from '../../components/icons';

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 p-4">
        <span className="flex items-center gap-2 text-lg font-bold text-red-500">
          <ShieldIcon className="h-5 w-5" />
          bSafe
        </span>
        <h1 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Admin</h1>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metric label="Total alerts" value={String(reports.data?.totals.alerts ?? '…')} />
          <Metric label="Active (24h)" value={String(reports.data?.activeNow ?? '…')} />
          <Metric label="Ack rate" value={reports.data ? `${Math.round(reports.data.ackRate * 100)}%` : '…'} />
          <Metric label="Avg to ack" value={fmtMinutes(reports.data?.avgAcknowledgeMinutes)} />
          <Metric label="Avg to resolve" value={fmtMinutes(reports.data?.avgResolveMinutes)} />
        </section>

        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-300">Alerts per day (last 30 days)</h2>
          <div
            role="img"
            aria-label="Bar chart of alerts per day over the last 30 days"
            className="mt-3 flex h-24 items-end gap-1"
          >
            {(reports.data?.alertsPerDay ?? []).map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.count} alert${d.count === 1 ? '' : 's'}`}
                className="flex flex-1 flex-col justify-end"
              >
                <div
                  className="min-h-[4px] rounded-t bg-red-600/70 transition-[height] duration-300"
                  style={{ height: `${Math.max(4, Math.round((d.count / maxDay) * 100))}%` }}
                />
              </div>
            ))}
          </div>
          {reports.data && reports.data.alertsPerDay.length === 0 && (
            <p className="mt-3 text-xs text-slate-500">No alerts recorded yet.</p>
          )}
        </section>

        <section className="mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Alerts</h2>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <span>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as '' | AlertStatus)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 outline-none transition-colors focus:border-red-500"
              >
                <option value="">All statuses</option>
                <option value="sent">Active</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Triggered</th>
                  <th className="px-4 py-3">Acknowledged</th>
                  <th className="px-4 py-3">Resolved</th>
                  <th className="px-4 py-3">Locs</th>
                  <th className="px-4 py-3">Delivered</th>
                  <th className="px-4 py-3">Retry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {alerts.data?.map((a) => (
                  <tr key={a.id} className="bg-slate-950/50 hover:bg-slate-900">
                    <td className="px-4 py-3">
                      <StatusPill status={a.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200">{a.userName}</div>
                      {a.userEmail && <div className="text-xs text-slate-500">{a.userEmail}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{fmt(a.triggeredAt)}</td>
                    <td className="px-4 py-3 text-slate-300">{fmt(a.acknowledgedAt)}</td>
                    <td className="px-4 py-3 text-slate-300">{fmt(a.resolvedAt)}</td>
                    <td className="px-4 py-3 text-slate-300">{a.locationCount}</td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-400">{a.deliveriesSent}</span>
                      {a.deliveriesFailed > 0 && (
                        <span className="ml-1 text-red-400">{a.deliveriesFailed} failed</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.deliveriesFailed > 0 ? (
                        <RetryButton alertId={a.id} />
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {alerts.data && alerts.data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No alerts match this filter.
                    </td>
                  </tr>
                )}
                {alerts.isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function RetryButton({ alertId }: { alertId: string }) {
  const retry = useRetryAlert(alertId);
  return (
    <button
      onClick={() => retry.mutate()}
      disabled={retry.isPending}
      className="rounded-lg border border-red-700 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-950 disabled:opacity-60"
    >
      {retry.isPending ? '…' : retry.isSuccess ? `Requeued ${retry.data.requeued}` : 'Retry'}
    </button>
  );
}