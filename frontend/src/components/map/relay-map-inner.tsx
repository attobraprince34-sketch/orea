"use client";

/**
 * Carte Leaflet + OpenStreetMap des points relais.
 * Chargée uniquement dans le navigateur (Leaflet manipule directement le DOM).
 */

import "@/styles/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import { ABIDJAN_CENTER } from "@/lib/constants";
import type { RelayPoint } from "@/lib/types";

function pinIcon(selected: boolean) {
  const size = selected ? 46 : 36;
  return L.divIcon({
    className: "orea-marker",
    iconSize: [size, size * 1.28],
    iconAnchor: [size / 2, size * 1.28],
    popupAnchor: [0, -size * 1.1],
    html: `<svg viewBox="0 0 140 180" width="${size}" height="${size * 1.28}" style="filter: drop-shadow(2px 3px 0 #0E1A16)">
      <path d="M70 0C108.66 0 140 31.34 140 70C140 104.5 109.6 134 79.6 170.6C74.6 176.7 65.4 176.7 60.4 170.6C30.4 134 0 104.5 0 70C0 31.34 31.34 0 70 0Z" fill="${selected ? "#F08A24" : "#0F5C47"}" stroke="#0E1A16" stroke-width="8"/>
      <circle cx="70" cy="70" r="34" fill="#FFFFFF"/>
      <circle cx="70" cy="70" r="16" fill="${selected ? "#0F5C47" : "#F08A24"}"/>
    </svg>`,
  });
}

function FocusOn({ point }: { point?: RelayPoint }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo([point.latitude, point.longitude], 14, { duration: 0.8 });
  }, [map, point]);
  return null;
}

export default function RelayMapInner({
  points,
  selectedId,
  onSelect,
  selectLabel = "Choisir ce point relais",
}: {
  points: RelayPoint[];
  selectedId?: string;
  onSelect?: (point: RelayPoint) => void;
  selectLabel?: string;
}) {
  const selected = points.find((p) => p.id === selectedId);
  return (
    <MapContainer
      center={ABIDJAN_CENTER}
      zoom={12}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FocusOn point={selected} />
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.latitude, point.longitude]}
          icon={pinIcon(point.id === selectedId)}
          title={point.name}
          keyboard
          eventHandlers={onSelect ? { click: () => onSelect(point) } : undefined}
        >
          <Popup>
            <p style={{ fontWeight: 700, margin: 0 }}>{point.name}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12 }}>
              {point.commune_label} · {point.address}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#4A6058" }}>{point.opening_hours}</p>
            {onSelect && (
              <button
                type="button"
                onClick={() => onSelect(point)}
                style={{
                  marginTop: 8,
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "2px solid #0E1A16",
                  background: "#F08A24",
                  color: "#0E1A16",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {selectLabel}
              </button>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
