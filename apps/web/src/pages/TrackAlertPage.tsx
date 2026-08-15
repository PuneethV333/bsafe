import { useParams } from 'react-router-dom';
import { LiveMap } from '../components/LiveMap';
import { StatusPill } from '../components/StatusPill';
import { AlertTriangleIcon, MapPinIcon } from '../components/icons';
import { useAcknowledgeTracking, useTracking } from '../lib/tracking';

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function TrackAlertPage() {
  const { token } = useParams<{ token: string }>();
  const tracking = useTracking(token);
  const acknowledge = useAcknowledgeTracking(token);

  if (tracking.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
        <AlertTriangleIcon className="h-8 w-8 text-red-500" />
        <h1 className="mt-3 text-xl font-semibold text-slate-200">Tracking link unavailable</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-400">
          This link is invalid or expired, or the server could not be reached.
        </p>
      </div>
    );
  }

  const data = tracking.data;
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-red-500" />
          Loading…
        </div>
      </div>
    );
  }

  const resolved = data.status === 'resolved';
  const lastLocation = data.lastLocation;

  const handleAcknowledge = () => {
    acknowledge.mutate(undefined, { onSuccess: () => tracking.refetch() });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 p-4">
        <span className="text-lg font-bold text-red-500">bSafe</span>
        <StatusPill status={data.status} />
      </header>

      <main className="mx-auto max-w-md p-4">
        <h1 className="text-xl font-semibold">
          {data.userName} triggered an SOS
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Alerted at {formatTime(data.triggeredAt)}
        </p>

        <div className="mt-4 h-72 w-full overflow-hidden rounded-xl border border-slate-800">
          {lastLocation ? (
            <LiveMap
              latitude={lastLocation.latitude}
              longitude={lastLocation.longitude}
              label={`Last seen ${formatTime(lastLocation.recordedAt)}`}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-slate-900 text-center text-slate-500">
              <MapPinIcon className="h-6 w-6 text-slate-600" />
              <p className="mt-2 text-sm">No location yet</p>
              <p className="mt-1 text-xs">Waiting for a GPS fix to come through…</p>
            </div>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Triggered</dt>
            <dd className="mt-1 text-slate-200">{formatTime(data.triggeredAt)}</dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              {lastLocation ? 'Last update' : 'Location fixes'}
            </dt>
            <dd className="mt-1 text-slate-200">
              {lastLocation ? formatTime(lastLocation.recordedAt) : data.locationCount}
            </dd>
          </div>
        </dl>

        {resolved ? (
          <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950 p-4 text-sm text-emerald-200">
            This alert was resolved{data.resolvedAt ? ` at ${formatTime(data.resolvedAt)}` : ''}. The live
            location is no longer being shared.
          </div>
        ) : (
          <>
            {acknowledge.isError && (
              <p className="mt-3 text-sm text-red-400">
                Could not acknowledge — try again.
              </p>
            )}
            {data.status === 'sent' && (
              <button
                onClick={handleAcknowledge}
                disabled={acknowledge.isPending}
                className="mt-4 w-full min-h-12 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
              >
                {acknowledge.isPending ? 'Acknowledging…' : 'I’m aware — acknowledge'}
              </button>
            )}
            <p className="mt-4 text-center text-xs text-slate-500">
              View-only link shared by your contact. It stops updating once the alert is resolved.
            </p>
          </>
        )}
      </main>
    </div>
  );
}