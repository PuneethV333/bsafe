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
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#e12d4a;border:3px solid #eef1f8;box-shadow:0 0 0 6px rgba(225,45,74,0.25),0 2px 8px rgba(0,0,0,.6)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function LiveMap({ latitude, longitude, label }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!mapRef.current) {
      const map = L.map(container, { attributionControl: true });
      map.setView([latitude, longitude], 15);
      // Dark basemap keeps the night palette; CARTO tiles are free with attribution.
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
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