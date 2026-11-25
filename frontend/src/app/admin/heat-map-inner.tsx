"use client";

/** Carte thermique d'Abidjan : un point pulsant par commune, proportionnel au nombre de pièces. */

import "@/styles/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

import { ABIDJAN_CENTER, COMMUNE_CENTERS } from "@/lib/constants";
import type { CountByLabel } from "@/lib/types";

function heatIcon(count: number, max: number) {
  const size = Math.round(18 + 46 * Math.sqrt(count / Math.max(max, 1)));
  const core = Math.max(10, Math.round(size * 0.42));
  return L.divIcon({
    className: "orea-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="heat-dot" style="width:${size}px;height:${size}px"><span style="width:${core}px;height:${core}px"></span></div>`,
  });
}

/** Assombrit les tuiles OSM standard (gratuites, sans clé) pour un rendu « nuit ». */
function NightTiles() {
  const map = useMap();
  useEffect(() => {
    const pane = map.getPane("tilePane");
    if (pane) pane.style.filter = "invert(1) hue-rotate(180deg) brightness(0.82) contrast(0.92) saturate(0.35)";
  }, [map]);
  return null;
}

export default function HeatMapInner({ data }: { data: CountByLabel[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <MapContainer
      center={ABIDJAN_CENTER}
      zoom={11}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl
      className="h-full w-full"
      style={{ background: "#0b1512" }}
    >
      {/* Tuiles OpenStreetMap (gratuites, sans clé), assombries par filtre CSS. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <NightTiles />
      {data
        .filter((d) => COMMUNE_CENTERS[d.key])
        .map((d) => (
          <Marker key={d.key} position={COMMUNE_CENTERS[d.key]} icon={heatIcon(d.count, max)} keyboard={false}>
            <Tooltip direction="top" offset={[0, -12]} opacity={1} permanent={d.count === max}>
              <strong>{d.label}</strong> · {d.count} pièce{d.count > 1 ? "s" : ""}
            </Tooltip>
          </Marker>
        ))}
    </MapContainer>
  );
}
