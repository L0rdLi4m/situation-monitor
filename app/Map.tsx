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
        </div>
    );
}