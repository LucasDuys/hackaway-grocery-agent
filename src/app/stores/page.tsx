"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/header";
import { StoreLogo } from "@/components/store-logo";
import { StoreFilter } from "@/components/store-filter";
import type { StoreSlug } from "@/lib/scrapers/types";

const ALL_STORES: StoreSlug[] = ["ah", "jumbo", "lidl", "picnic", "plus", "aldi"];

const STORE_COLORS: Record<StoreSlug, string> = {
  ah: "#00a0e2",
  jumbo: "#ffc800",
  lidl: "#0050aa",
  picnic: "#ff6600",
  plus: "#00a651",
  aldi: "#00205b",
};

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

// Dynamic import for the map component to avoid SSR issues with Leaflet
const StoreMap = dynamic(() => import("./store-map"), { ssr: false });

export default function StoresPage() {
  const [postalCode, setPostalCode] = useState("");
  const [lat, setLat] = useState(52.1326);
  const [lng, setLng] = useState(5.2913);
  const [radius, setRadius] = useState(5);
  const [selectedStores, setSelectedStores] = useState<string[]>([...ALL_STORES]);
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStores = useCallback(async (searchLat: number, searchLng: number) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const storesParam = selectedStores.length < ALL_STORES.length
        ? `&stores=${selectedStores.join(",")}`
        : "";
      const res = await fetch(
        `/api/stores/nearby?lat=${searchLat}&lng=${searchLng}&radius=${radius}${storesParam}`,
        { signal: controller.signal }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Request failed with status ${res.status}`);
      }

      const json = await res.json() as { stores: NearbyStore[] };
      setStores(json.stores);
      setHasSearched(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch stores");
    } finally {
      setLoading(false);
    }
  }, [selectedStores, radius]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        setLat(newLat);
        setLng(newLng);
        setPostalCode("");
        fetchStores(newLat, newLng);
      },
      () => {
        setError("Unable to retrieve your location");
      }
    );
  }, [fetchStores]);

  const handlePostalCodeSearch = useCallback(async () => {
    if (!postalCode.trim()) return;

    // Use Nominatim to geocode Dutch postal codes
    try {
      setLoading(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(postalCode + " Netherlands")}&limit=1`
      );
      const results = await res.json() as Array<{ lat: string; lon: string }>;

      if (results.length === 0) {
        setError("Postal code not found");
        setLoading(false);
        return;
      }

      const newLat = parseFloat(results[0].lat);
      const newLng = parseFloat(results[0].lon);
      setLat(newLat);
      setLng(newLng);
      fetchStores(newLat, newLng);
    } catch {
      setError("Failed to geocode postal code");
      setLoading(false);
    }
  }, [postalCode, fetchStores]);

  // Re-fetch when radius or selected stores change (only if already searched)
  useEffect(() => {
    if (hasSearched) {
      fetchStores(lat, lng);
    }
  }, [radius, selectedStores]); // eslint-disable-line react-hooks/exhaustive-deps

  const radiusOptions = [1, 2, 5, 10];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">

          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Store Locator
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Find supermarkets near you
            </p>
          </div>

          {/* Search Controls */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              {/* Postal code input */}
              <div className="flex-1">
                <label
                  htmlFor="postal-code"
                  className="block text-sm font-medium text-[var(--text-secondary)]"
                >
                  Postal code
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="postal-code"
                    type="text"
                    placeholder="e.g. 1012 AB"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handlePostalCodeSearch();
                    }}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
                  />
                  <button
                    type="button"
                    onClick={handlePostalCodeSearch}
                    className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                  >
                    Search
                  </button>
                </div>
              </div>

              {/* Use my location */}
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
              >
                Use my location
              </button>
            </div>

            {/* Radius slider */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Radius
              </label>
              <div className="mt-2 flex gap-2">
                {radiusOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadius(r)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      radius === r
                        ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </div>

            {/* Store filter */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Stores
              </label>
              <div className="mt-2">
                <StoreFilter selectedStores={selectedStores} onChange={setSelectedStores} />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-[var(--danger)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* Map */}
          <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
            <StoreMap
              center={[lat, lng]}
              stores={stores}
              storeColors={STORE_COLORS}
              loading={loading}
            />
          </div>

          {/* Store List */}
          {stores.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {stores.length} store{stores.length !== 1 ? "s" : ""} found
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <StoreLogo slug={store.storeSlug} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--text-primary)] capitalize">
                        {store.storeSlug}
                      </p>
                      {store.address && (
                        <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                          {store.address}
                        </p>
                      )}
                      {store.city && (
                        <p className="text-xs text-[var(--text-muted)]">
                          {store.city}{store.postalCode ? `, ${store.postalCode}` : ""}
                        </p>
                      )}
                      <p className="mt-1 text-xs font-medium text-[var(--accent)]">
                        {store.distanceKm} km away
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {hasSearched && stores.length === 0 && !loading && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                No stores found within {radius} km. Try increasing the radius.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
