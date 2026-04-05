"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { StoreSlug } from "@/lib/scrapers/types";

interface NearbyStore {
  id: string;
  storeSlug: StoreSlug;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  distanceKm: number;
}

interface StoreMapProps {
  center: [number, number];
  stores: NearbyStore[];
  storeColors: Record<StoreSlug, string>;
  loading: boolean;
}

function createStoreIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: ${color};
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

export default function StoreMap({ center, stores, storeColors, loading }: StoreMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update center
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, 12);
    }
  }, [center]);

  // Update markers
  useEffect(() => {
    if (!markersRef.current) return;

    markersRef.current.clearLayers();

    for (const store of stores) {
      const color = storeColors[store.storeSlug] ?? "#666";
      const icon = createStoreIcon(color);
      const marker = L.marker([store.latitude, store.longitude], { icon });

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; min-width: 140px;">
          <strong style="text-transform: capitalize;">${store.storeSlug}</strong><br/>
          ${store.address ? `${store.address}<br/>` : ""}
          ${store.city ? `${store.city}${store.postalCode ? `, ${store.postalCode}` : ""}<br/>` : ""}
          <span style="color: #e8590c; font-weight: 600;">${store.distanceKm} km</span>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersRef.current.addLayer(marker);
    }
  }, [stores, storeColors]);

  return (
    <div className="relative">
      <div ref={containerRef} style={{ height: 400, width: "100%" }} />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)]/60">
          <p className="rounded-lg bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] shadow-sm">
            Loading stores...
          </p>
        </div>
      )}
    </div>
  );
}
