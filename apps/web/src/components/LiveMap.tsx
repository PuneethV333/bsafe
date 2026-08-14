import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LiveMapProps {
  latitude: number;
  longitude: number;
  label?: string;
}

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function LiveMap({ latitude, longitude, label }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!mapRef.current) {
      const map = L.map(container);
      map.setView([latitude, longitude], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
    }

    const map = mapRef.current;
    if (!markerRef.current) {
      markerRef.current = L.marker([latitude, longitude], { icon: pinIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng([latitude, longitude]);
    }
    const zoom = Math.max(map.getZoom() || 15, 15);
    map.setView([latitude, longitude], zoom);
    if (label) markerRef.current.bindPopup(label).openPopup();
  }, [latitude, longitude, label]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-lg"
      role="img"
      aria-label="live location map"
    />
  );
}