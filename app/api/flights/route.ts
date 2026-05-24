export const revalidate = 10; // cache the response for 10 seconds

type State = [
    string, string | null, string, number | null, number | null,
        number | null, number | null, number | null, boolean,
        number | null, number | null, ...unknown[]
];

export async function GET() {
    const res = await fetch('https://opensky-network.org/api/states/all', {
        next: { revalidate: 10 },
    });

    if (!res.ok) {
        return Response.json({ error: 'OpenSky unavailable' }, { status: 502 });
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
}