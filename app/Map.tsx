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
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: [0, 20],
            zoom: 1.5,
        });

        map.on('load', () => {
            map.setProjection({ type: 'globe' });
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