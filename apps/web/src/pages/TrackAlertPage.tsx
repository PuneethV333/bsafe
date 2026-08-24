import { useParams } from 'react-router-dom';
import { LiveMap } from '../components/LiveMap';
import { StatusPill } from '../components/StatusPill';
import { AlertTriangleIcon, MapPinIcon, SosMark } from '../components/icons';
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-night p-6 text-center text-chalk">
        <AlertTriangleIcon className="h-9 w-9 text-signal" />
        <h1 className="mt-4 font-display text-xl font-semibold">Tracking link unavailable</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-mist">
          This link is invalid or expired, or the server could not be reached.
        </p>
      </div>
    );
  }

  const data = tracking.data;
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-night text-mist">
        <div className="flex items-center gap-3 font-mono text-xs tracking-widest">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-signal" />
          LOCATING…
        </div>
      </div>
    );
  }

  const resolved = data.status === 'resolved';
  const lastLocation = data.lastLocation;
  const accuracyMeters =
    lastLocation?.accuracy && lastLocation.accuracy > 0
      ? Math.round(lastLocation.accuracy)
      : null;

  const handleAcknowledge = () => {
    acknowledge.mutate(undefined, { onSuccess: () => tracking.refetch() });
  };

  return (
    <div className="min-h-screen bg-night text-chalk">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line/70 bg-night/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold tracking-tight">bSafe</span>
          <SosMark className="hidden h-2.5 w-16 text-signal sm:block" />
        </div>
        <StatusPill status={data.status} />
      </header>

      <main className="mx-auto max-w-md p-4">
        <p className="eyebrow">Emergency alert</p>
        <h1 className="mt-2 font-display text-2xl font-semibold leading-snug tracking-tight">
          {data.userName} triggered an SOS
        </h1>
        <p className="mt-1.5 font-mono text-xs text-mist">
          ALERTED {formatTime(data.triggeredAt).toUpperCase()}
        </p>

        <div className="mt-5 h-80 w-full overflow-hidden rounded-2xl border border-line">
          {lastLocation ? (
            <LiveMap
              latitude={lastLocation.latitude}
              longitude={lastLocation.longitude}
              accuracy={lastLocation.accuracy}
              label={`Last seen ${formatTime(lastLocation.recordedAt)}${accuracyMeters ? ` · ±${accuracyMeters}m` : ''}`}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-panel text-center text-mist">
              <MapPinIcon className="h-6 w-6 text-faint" />
              <p className="mt-2 text-sm">No location yet</p>
              <p className="mt-1 font-mono text-[11px] text-faint">WAITING FOR A GPS FIX…</p>
            </div>
          )}
        </div>

        {lastLocation && (
          <a
            href={`https://www.google.com/maps?q=${lastLocation.latitude},${lastLocation.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line-bright bg-panel px-4 py-3 font-mono text-xs tracking-widest text-chalk transition-colors hover:border-safe/60 hover:text-safe-soft"
          >
            OPEN IN GOOGLE MAPS ↗
          </a>
        )}
        {accuracyMeters !== null && (
          <p className="mt-2 text-center font-mono text-[11px] tracking-wider text-faint">
            GPS ACCURACY ±{accuracyMeters}M
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-panel p-3.5">
            <dt className="font-mono text-[11px] uppercase tracking-wider text-faint">Triggered</dt>
            <dd className="mt-1 font-mono text-xs text-chalk">{formatTime(data.triggeredAt)}</dd>
          </div>
          <div className="rounded-2xl border border-line bg-panel p-3.5">
            <dt className="font-mono text-[11px] uppercase tracking-wider text-faint">
              {lastLocation ? 'Last update' : 'Location fixes'}
            </dt>
            <dd className="mt-1 font-mono text-xs text-chalk">
              {lastLocation ? formatTime(lastLocation.recordedAt) : data.locationCount}
            </dd>
          </div>
        </dl>

        {resolved ? (
          <div className="mt-4 flex gap-3 rounded-2xl border border-safe/30 bg-safe/10 p-4 text-sm leading-relaxed text-safe-soft">
            <span aria-hidden className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-safe" />
            <p>
              This alert was resolved{data.resolvedAt ? ` at ${formatTime(data.resolvedAt)}` : ''}. The live
              location is no longer being shared.
            </p>
          </div>
        ) : (
          <>
            {acknowledge.isError && (
              <p className="mt-3 text-sm text-signal-soft">
                Could not acknowledge — try again.
              </p>
            )}
            {data.status === 'sent' && (
              <button
                onClick={handleAcknowledge}
                disabled={acknowledge.isPending}
                className="mt-5 w-full rounded-xl bg-signal px-4 py-4 text-sm font-semibold text-white shadow-[0_14px_40px_-14px_rgba(225,45,74,0.7)] transition-colors hover:bg-signal-bright disabled:opacity-60"
              >
                {acknowledge.isPending ? 'Acknowledging…' : 'I’m aware — acknowledge'}
              </button>
            )}
            <p className="mt-4 text-center font-mono text-[11px] leading-relaxed text-faint">
              View-only link shared by your contact. It stops updating once the alert is resolved.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
