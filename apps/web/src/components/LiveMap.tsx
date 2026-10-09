import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LiveMapProps {
  latitude: number;
  longitude: number;
  label?: string;
  /** GPS accuracy in meters — drawn as a translucent halo around the pin. */
  accuracy?: number | null;
}

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#e12d4a;border:3px solid #eef1f8;box-shadow:0 0 0 6px rgba(225,45,74,0.25),0 2px 8px rgba(0,0,0,.6)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const accuracyStyle: Omit<L.CircleMarkerOptions, 'radius'> = {
  color: '#e12d4a',
  weight: 1,
  opacity: 0.5,
  fillColor: '#e12d4a',
  fillOpacity: 0.12,
};

/**
 * Esri's Dark Gray Canvas basemap — no API key, dark enough for the night
 * palette. CARTO was serving an "API KEY REQUIRED" watermark tile instead of
 * map data. Esri orders tiles {z}/{y}/{x}; Leaflet's `{-y}` inverts the row
 * so the standard {x}/{y} placeholders work. Reference is the label overlay.
 */
const BASE_TILES =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{-y}/{x}';
const LABEL_TILES =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{-y}/{x}';
const ESRI_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, DeLorme, NAVTEQ';
// Esri's canvas basemap is published to z16; beyond that we overzoom.
const MAX_NATIVE_ZOOM = 16;

export function LiveMap({ latitude, longitude, label, accuracy }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const followRef = useRef(true);
  const centeredOnRef = useRef<{ lat: number; lng: number } | null>(null);
  const popupOpenedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!mapRef.current) {
      const map = L.map(container, { attributionControl: true });
      map.setView([latitude, longitude], 15);
      // Dark basemap keeps the night palette.
      L.tileLayer(BASE_TILES, {
        attribution: ESRI_ATTRIBUTION,
        maxZoom: 18,
        maxNativeZoom: MAX_NATIVE_ZOOM,
      }).addTo(map);
      // Street labels on their own layer so the pin still reads on top.
      L.tileLayer(LABEL_TILES, {
        maxZoom: 18,
        maxNativeZoom: MAX_NATIVE_ZOOM,
        pane: 'tilePane',
        opacity: 0.85,
      }).addTo(map);

      resizeObserverRef.current = new ResizeObserver(() => map.invalidateSize());
      resizeObserverRef.current.observe(container);

      // Once the viewer pans or zooms themselves, stop auto-following the pin
      // so fresh fixes never yank the viewport back while they explore.
      map.on('dragstart zoomstart', () => {
        followRef.current = false;
      });

      mapRef.current = map;
    }
    const map = mapRef.current;

    if (!markerRef.current) {
      markerRef.current = L.marker([latitude, longitude], { icon: pinIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng([latitude, longitude]);
    }

    if (accuracy && accuracy > 0) {
      if (!circleRef.current) {
        circleRef.current = L.circle([latitude, longitude], {
          ...accuracyStyle,
          radius: accuracy,
        }).addTo(map);
      } else {
        circleRef.current.setLatLng([latitude, longitude]);
        circleRef.current.setRadius(accuracy);
      }
    } else if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    const marker = markerRef.current as L.Marker;
    if (label) {
      if (marker.getPopup()) {
        marker.setPopupContent(label);
      } else {
        marker.bindPopup(label);
      }
      if (!popupOpenedRef.current) {
        marker.openPopup();
        popupOpenedRef.current = true;
      }
    } else if (marker.getPopup()) {
      marker.unbindPopup();
      popupOpenedRef.current = false;
    }

    const moved =
      !centeredOnRef.current ||
      Math.abs(centeredOnRef.current.lat - latitude) > 1e-6 ||
      Math.abs(centeredOnRef.current.lng - longitude) > 1e-6;
    if (moved && followRef.current) {
      map.panTo([latitude, longitude], { animate: true });
      centeredOnRef.current = { lat: latitude, lng: longitude };
    }
  }, [latitude, longitude, label, accuracy]);

  useEffect(
    () => () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
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
