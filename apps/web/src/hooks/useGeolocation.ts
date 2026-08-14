import { useCallback, useEffect, useRef, useState } from 'react';

export type GeoStatus =
  | 'idle'
  | 'unsupported'
  | 'prompting'
  | 'granted'
  | 'denied'
  | 'unavailable';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 5_000,
};

function toPosition(pos: GeolocationPosition): GeoPosition {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? undefined,
    timestamp: pos.timestamp,
  };
}

/**
 * Wraps the browser Geolocation API.
 *
 * - `requestPermission()` is the ONLY path that triggers the browser prompt —
 *   call it during onboarding, never during the crisis moment.
 * - `startWatching()` kicks off a high-accuracy `watchPosition` loop.
 * - Degraded cases: denied permission → `denied`; GPS unavailable/timeout →
 *   `unavailable`. In both cases the last-known position is retained so a
 *   trigger can still share it.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    const onSuccess = (pos: GeolocationPosition) => {
      setPosition(toPosition(pos));
      setStatus('granted');
      setError(null);
    };
    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setStatus('denied');
        setError('Location permission denied.');
      } else {
        // TIMEOUT / POSITION_UNAVAILABLE — keep last-known position for degraded sharing.
        setStatus('unavailable');
        setError('GPS unavailable right now — sharing last known location.');
      }
    };
    // One immediate fix (also surfaces the prompt when not yet granted).
    navigator.geolocation.getCurrentPosition(onSuccess, onError, WATCH_OPTIONS);
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, WATCH_OPTIONS);
  }, []);

  const requestPermission = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    // Check state without prompting when the Permissions API is available.
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((perm) => {
          if (perm.state === 'denied') {
            setStatus('denied');
            return;
          }
        })
        .catch(() => {
          // Fall through and let the prompt fire.
        });
    }
    setStatus('prompting');
    startWatching();
  }, [startWatching]);

  useEffect(() => stopWatching, [stopWatching]);

  return {
    status,
    position,
    error,
    requestPermission,
    startWatching,
    stopWatching,
  };
}
