export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type AdsbAircraft = {
    hex: string;
    flight?: string;
    r?: string;        // registration
    t?: string;        // type
    lat?: number;
    lon?: number;
    alt_baro?: number | 'ground';
    gs?: number;       // ground speed (knots)
    track?: number;    // true track in degrees
    category?: string;
};

export async function GET(request: Request) {
    void request.url;

    try {
        // ADSB.lol "/v2/all" returns every aircraft currently being tracked
        const res = await fetch('https://api.adsb.lol/v2/mil', {
            signal: AbortSignal.timeout(20000),
            cache: 'no-store',
        });
        // Actually we want ALL flights, not just military. Use the proper endpoint:
        const allRes = await fetch('https://api.adsb.lol/v2/lat/0/lon/0/dist/12500', {
            signal: AbortSignal.timeout(20000),
            cache: 'no-store',
        });

        if (!allRes.ok) {
            return Response.json(
                { flights: [], error: `ADSB.lol ${allRes.status}` },
                { status: 200 },
            );
        }

        const data = await allRes.json();
        const aircraft: AdsbAircraft[] = data.ac || [];

        const flights = aircraft
            .filter((a) => a.lon != null && a.lat != null)
            .map((a) => ({
                icao24: a.hex,
                callsign: a.flight?.trim() || null,
                country: null,
                lon: a.lon,
                lat: a.lat,
                altitude: typeof a.alt_baro === 'number' ? a.alt_baro * 0.3048 : 0, // ft → m
                onGround: a.alt_baro === 'ground',
                velocity: a.gs ? a.gs * 0.514444 : null, // knots → m/s
                heading: a.track ?? null,
            }));

        return Response.json({ flights, count: flights.length, time: Math.floor(Date.now() / 1000) });
    } catch (err) {
        return Response.json(
            { flights: [], error: String(err instanceof Error ? err.message : err) },
            { status: 200 },
        );
    }
}