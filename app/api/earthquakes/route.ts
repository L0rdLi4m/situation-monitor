export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type UsgsFeature = {
    id: string;
    properties: {
        mag: number | null;
        place: string | null;
        time: number;
        url: string;
        title: string;
    };
    geometry: {
        coordinates: [number, number, number]; // [lon, lat, depth_km]
    };
};

export async function GET(request: Request) {
    void request.url;

    try {
        // USGS feeds: significant_week, 4.5_week, 2.5_week, 1.0_week, all_week
        // "all_day" is past 24h, "2.5_week" is M2.5+ in past 7 days. Pick your level.
        const res = await fetch(
            'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
            { signal: AbortSignal.timeout(15000), cache: 'no-store' },
        );

        if (!res.ok) {
            return Response.json({ earthquakes: [], error: `USGS ${res.status}` }, { status: 200 });
        }

        const data = await res.json();
        const features: UsgsFeature[] = data.features || [];

        const earthquakes = features
            .filter((f) => f.geometry?.coordinates && f.properties?.mag != null)
            .map((f) => ({
                id: f.id,
                magnitude: f.properties.mag,
                place: f.properties.place,
                title: f.properties.title,
                time: f.properties.time, // ms epoch
                url: f.properties.url,
                lon: f.geometry.coordinates[0],
                lat: f.geometry.coordinates[1],
                depth: f.geometry.coordinates[2],
            }));

        return Response.json({ earthquakes, count: earthquakes.length });
    } catch (err) {
        return Response.json(
            { earthquakes: [], error: String(err instanceof Error ? err.message : err) },
            { status: 200 },
        );
    }
}