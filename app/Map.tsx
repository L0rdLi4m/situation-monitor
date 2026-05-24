'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function Map() {
    const mapRef = useRef<maplibregl.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isGlobe, setIsGlobe] = useState(true);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [0, 20],
            zoom: 1.5,
        });

        map.on('load', () => {
            map.setProjection({ type: 'globe' });

            map.addSource('flights', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });

            map.addLayer({
                id: 'flights-layer',
                type: 'circle',
                source: 'flights',
                paint: {
                    'circle-radius': 3,
                    'circle-color': '#fbbf24',          // amber, pops on dark
                    'circle-stroke-width': 0.5,
                    'circle-stroke-color': '#1f2937',
                },
            });

            const updateFlights = async () => {
                try {
                    const res = await fetch('/api/flights');
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const { flights } = await res.json();
                    const features = flights.map((f: { lon: number; lat: number; [k: string]: unknown }) => ({
                        type: 'Feature' as const,
                        geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] },
                        properties: f,
                    }));
                    const src = map.getSource('flights') as maplibregl.GeoJSONSource;
                    src.setData({ type: 'FeatureCollection', features });
                    console.log(`Updated ${features.length} flights`);
                } catch (err) {
                    console.error('Flight update failed', err);
                }
            };

            updateFlights();
            const interval = setInterval(updateFlights, 15000);
            map.once('remove', () => clearInterval(interval));
            const popup = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: false,
            });

            // Earthquakes layer
            map.addSource('earthquakes', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });

            map.addLayer({
                id: 'earthquakes-layer',
                type: 'circle',
                source: 'earthquakes',
                paint: {
                    // Radius scales with magnitude (bigger = bigger)
                    'circle-radius': [
                        'interpolate', ['linear'], ['get', 'magnitude'],
                        2.5, 3,
                        5, 8,
                        7, 18,
                        9, 30,
                    ],
                    // Color goes from yellow → red → purple as magnitude rises
                    'circle-color': [
                        'interpolate', ['linear'], ['get', 'magnitude'],
                        2.5, '#fef08a',
                        4, '#fb923c',
                        5.5, '#ef4444',
                        7, '#a21caf',
                    ],
                    'circle-opacity': 0.6,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#fff',
                    'circle-stroke-opacity': 0.4,
                },
            });

            const updateEarthquakes = async () => {
                try {
                    const res = await fetch('/api/earthquakes');
                    const { earthquakes } = await res.json();
                    const features = earthquakes.map((eq: {
                        lon: number; lat: number; [k: string]: unknown;
                    }) => ({
                        type: 'Feature' as const,
                        geometry: { type: 'Point' as const, coordinates: [eq.lon, eq.lat] },
                        properties: eq,
                    }));
                    const src = map.getSource('earthquakes') as maplibregl.GeoJSONSource;
                    src.setData({ type: 'FeatureCollection', features });
                    console.log(`Updated ${features.length} earthquakes`);
                } catch (err) {
                    console.error('Earthquake update failed', err);
                }
            };

            updateEarthquakes();
            // USGS updates every minute, but every 5 min is plenty for the map
            const eqInterval = setInterval(updateEarthquakes, 5 * 60 * 1000);
            map.once('remove', () => clearInterval(eqInterval));

            map.on('mouseenter', 'flights-layer', (e) => {
                map.getCanvas().style.cursor = 'pointer';
                const f = e.features?.[0];
                if (!f) return;
                const p = f.properties as {
                    callsign?: string;
                    country?: string;
                    altitude?: number;
                    velocity?: number;
                };
                const html = `
                    <div style="font-family: system-ui; font-size: 12px; line-height: 1.4;">
                      <div style="font-weight: 600; font-size: 13px;">${p.callsign || 'unknown'}</div>
                      <div style="color: #666;">${p.country || ''}</div>
                      <div style="margin-top: 4px;">
                        ${p.altitude ? Math.round(p.altitude) + ' m' : '—'}
                        ${p.velocity ? ' · ' + Math.round(p.velocity * 3.6) + ' km/h' : ''}
                      </div>
                    </div>
                  `;
                const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
                popup.setLngLat(coords).setHTML(html).addTo(map);
            });

            map.on('mouseleave', 'flights-layer', () => {
                map.getCanvas().style.cursor = '';
                popup.remove();
            });

            map.on('mouseenter', 'earthquakes-layer', (e) => {
                map.getCanvas().style.cursor = 'pointer';
                const f = e.features?.[0];
                if (!f) return;
                const p = f.properties as {
                    magnitude: number;
                    place?: string;
                    time: number;
                    depth?: number;
                };
                const when = new Date(p.time).toLocaleString();
                const html = `
                    <div style="font-family: system-ui; font-size: 12px; line-height: 1.4;">
                      <div style="font-weight: 600; font-size: 14px;">
                        M${p.magnitude.toFixed(1)} earthquake
                      </div>
                      <div style="color: #666;">${p.place || ''}</div>
                      <div style="margin-top: 4px;">
                        ${p.depth != null ? Math.round(p.depth) + ' km deep' : ''}
                      </div>
                      <div style="color: #999; font-size: 11px; margin-top: 2px;">${when}</div>
                    </div>
                  `;
                const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
                popup.setLngLat(coords).setHTML(html).addTo(map);
            });

            map.on('mouseleave', 'earthquakes-layer', () => {
                map.getCanvas().style.cursor = '';
                popup.remove();
            });
        });

        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!mapRef.current || !mapRef.current.loaded()) return;
        mapRef.current.setProjection({ type: isGlobe ? 'globe' : 'mercator' });
    }, [isGlobe]);

    return (
        <div className="relative h-screen w-screen">
            <div ref={containerRef} className="h-full w-full" />
            <button
                onClick={() => setIsGlobe(!isGlobe)}
                className="absolute top-4 right-4 bg-white px-3 py-2 rounded shadow-md text-sm font-medium hover:bg-gray-100"
            >
                {isGlobe ? '🗺 Flat' : '🌍 Globe'}
            </button>
            <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-3 py-2 rounded max-w-xs">
                <div className="font-semibold mb-1">Flight coverage</div>
                <div className="text-gray-300">
                    ADS-B ground receivers via adsb.lol. Oceanic and remote regions
                    have limited coverage.
                </div>
            </div>
        </div>
    );

    return (
        <div className="relative h-screen w-screen">
            <div ref={containerRef} className="h-full w-full" />
            <button
                onClick={() => setIsGlobe(!isGlobe)}
                className="absolute top-4 right-4 bg-white px-3 py-2 rounded shadow-md text-sm font-medium hover:bg-gray-100"
            >
                {isGlobe ? '🗺 Flat' : '🌍 Globe'}
            </button>
        </div>
    );
}