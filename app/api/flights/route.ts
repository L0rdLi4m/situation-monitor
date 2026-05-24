export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type State = [
    string, string | null, string, number | null, number | null,
        number | null, number | null, number | null, boolean,
        number | null, number | null, ...unknown[]
];

export async function GET(request: Request) {
    void request.url;

    try {
        const res = await fetch('https://opensky-network.org/api/states/all', {
            signal: AbortSignal.timeout(8000),
            cache: 'no-store',
        });

        if (!res.ok) {
            return Response.json({ flights: [], error: 'OpenSky unavailable' }, { status: 200 });
        }

        const data = await res.json();
        const flights = (data.states as State[] || [])
            .map((s) => ({
                icao24: s[0],
                callsign: s[1]?.trim() ?? null,
                country: s[2],
                lon: s[5],
                lat: s[6],
                altitude: s[7],
                onGround: s[8],
                velocity: s[9],
                heading: s[10],
            }))
            .filter((f) => f.lon != null && f.lat != null);

        return Response.json({ flights, time: data.time });
    } catch (err) {
        return Response.json({ flights: [], error: String(err) }, { status: 200 });
    }
}