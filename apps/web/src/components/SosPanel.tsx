import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlertDto, TriggerType } from '@bsafe/shared-types';
import type { Socket } from 'socket.io-client';
import { useContacts } from '../lib/contacts';
import { useGeolocation, type GeoPosition } from '../hooks/useGeolocation';
import {
  joinAlertRoom,
  openAlertSocket,
  pushLocation,
} from '../lib/alertSocket';
import {
  sendLocationViaREST,
  useAlert,
  useTriggerAlert,
  useUpdateAlertStatus,
} from '../lib/alerts';
import { auth } from '../lib/firebase';
import { SosButton } from './SosButton';

const LOCATION_INTERVAL_MS = 12_000;
const ACTIVE_ALERT_KEY = 'bsafe.activeAlertId';

function readActiveAlertId(): string | null {
  return localStorage.getItem(ACTIVE_ALERT_KEY);
}

/**
 * SOS trigger panel: geolocation onboarding (permission requested up-front, not
 * at the crisis moment), silent tap/long-press trigger, and the live location
 * stream (WebSocket with REST fallback) that runs until the alert is resolved.
 */
export function SosPanel() {
  const contacts = useContacts();
  const geo = useGeolocation();
  const trigger = useTriggerAlert();
  const updateStatus = useUpdateAlertStatus();

  const [activeAlertId, setActiveAlertId] = useState<string | null>(readActiveAlertId);
  const positionRef = useRef<GeoPosition | null>(null);
  const position = geo.position;
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const alertQuery = useAlert(activeAlertId);
  const alert: AlertDto | null = alertQuery.data ?? null;
  const isActive = Boolean(activeAlertId) && alert?.status !== 'resolved';

  const clearActiveAlert = useCallback(() => {
    localStorage.removeItem(ACTIVE_ALERT_KEY);
    setActiveAlertId(null);
  }, []);

  const handleTrigger = useCallback(
    (type: TriggerType) => {
      if (isActive || contacts.data?.length === 0) return;
      const last = positionRef.current;
      trigger.mutate(
        {
          triggerType: type,
          ...(last
            ? { latitude: last.latitude, longitude: last.longitude, accuracy: last.accuracy }
            : {}),
        },
        {
          onSuccess: (created) => {
            localStorage.setItem(ACTIVE_ALERT_KEY, created.id);
            setActiveAlertId(created.id);
          },
        },
      );
    },
    [isActive, contacts.data?.length, trigger],
  );

  const handleResolve = useCallback(() => {
    if (!activeAlertId) return;
    updateStatus.mutate(
      { id: activeAlertId, status: 'resolved' },
      { onSuccess: clearActiveAlert },
    );
  }, [activeAlertId, updateStatus, clearActiveAlert]);

  // Live streaming loop: connect socket, join the alert room, push a fix every
  // 12s (or last-known on backgrounding); fall back to REST when the socket drops.
  const resolved = alert?.status === 'resolved';
  useEffect(() => {
    if (!activeAlertId || resolved) return;
    const alertId = activeAlertId;

    let socket: Socket | null = null;
    let disposed = false;
    let intervalId: number | null = null;

    const push = (pos: GeoPosition) => {
      const payload = {
        alertId,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
      };
      if (socket?.connected) {
        pushLocation(socket, payload);
      } else {
        sendLocationViaREST(alertId, payload).catch(() => {
          // Degraded network — next tick retries.
        });
      }
    };

    const tick = () => {
      const p = positionRef.current;
      if (p) push(p);
    };

    const onVisibility = () => {
      // Backgrounded tab → push last-known location so contacts keep a fix.
      if (document.visibilityState === 'hidden') tick();
    };

    void auth?.currentUser?.getIdToken().then((token) => {
      if (disposed || !token) return;
      socket = openAlertSocket(token);
      socket.on('connect', () => {
        joinAlertRoom(socket!, alertId);
        tick();
      });
      // connect_error → REST fallback covers subsequent ticks.
    });

    intervalId = window.setInterval(tick, LOCATION_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      socket?.disconnect();
      // Cleared once the alert resolves (or when a newer alert replaces it).
      if (localStorage.getItem(ACTIVE_ALERT_KEY) === alertId) {
        localStorage.removeItem(ACTIVE_ALERT_KEY);
      }
    };
  }, [activeAlertId, resolved]);

  const count = contacts.data?.length ?? 0;

  if (contacts.isError) {
    return <p className="text-sm text-red-400">Could not load contacts.</p>;
  }

  if (contacts.isPending) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  if (count === 0) {
    return (
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-sm text-amber-300">
          SOS is disabled — you need at least one emergency contact.
        </p>
        <a
          href="/contacts"
          className="mt-3 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
        >
          Add an emergency contact
        </a>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
      {/* Location onboarding — permission requested here, not at the crisis moment. */}
      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-200">
            {geo.status === 'granted'
              ? 'Live location on'
              : geo.status === 'denied' || geo.status === 'unsupported'
                ? 'Location unavailable'
                : 'Enable location during setup'}
          </p>
          <p className="text-xs text-slate-400">
            {geo.status === 'denied'
              ? 'SOS will share only your last known position.'
              : geo.status === 'unavailable'
                ? 'GPS unavailable right now — using last known position.'
              : geo.status === 'granted'
                ? 'Trusted contacts will see your live position during an alert.'
                : 'Requested up-front so SOS works instantly in an emergency.'}
          </p>
        </div>
        {(geo.status === 'idle' || geo.status === 'prompting') && (
          <button
            onClick={() => geo.requestPermission()}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
          >
            Enable
          </button>
        )}
      </div>

      <div className="flex justify-center">
        <SosButton
          onTrigger={handleTrigger}
          disabled={trigger.isPending}
          active={isActive}
        />
      </div>

      {trigger.isPending && (
        <p className="text-center text-xs text-slate-400">…</p>
      )}

      {isActive && (
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-widest text-red-400/80">SOS active</p>
          {alert?.locationCount !== undefined && (
            <p className="text-xs text-slate-400">{alert.locationCount} location updates shared</p>
          )}
          <button
            onClick={handleResolve}
            disabled={updateStatus.isPending}
            className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
          >
            {updateStatus.isPending ? 'Resolving…' : 'Resolve alert'}
          </button>
        </div>
      )}
    </div>
  );
}
