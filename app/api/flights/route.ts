export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type State = [
    string, string | null, string, number | null, number | null,
        number | null, number | null, number | null, boolean,
        number | null, number | null, ...unknown[]
];

// In-memory token cache. Tokens last 30 min; refresh at 25.
let cachedToken: { token: string; expires: number } | null = null;

async function getOpenSkyToken(): Promise<string | null> {
    const clientId = process.env.OPENSKY_CLIENT_ID;
    const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    if (cachedToken && Date.now() < cachedToken.expires) {
        return cachedToken.token;
    }

    const res = await fetch(
        'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
            }),
        },
    );

    if (!res.ok) return null;
    const data = await res.json();
    cachedToken = {
        token: data.access_token,
        expires: Date.now() + 25 * 60 * 1000, // 25 minutes
    };
    return data.access_token;
}

export async function GET(request: Request) {
    void request.url;

    try {
        const token = await getOpenSkyToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch('https://opensky-network.org/api/states/all', {
            signal: AbortSignal.timeout(25000),
            cache: 'no-store',
            headers,
        });

        if (!res.ok) {
            return Response.json(
                { flights: [], error: `OpenSky ${res.status}` },
                { status: 200 },
            );
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

        return Response.json({ flights, time: data.time, count: flights.length });
    } catch (err) {
        return Response.json({ flights: [], error: String(err) }, { status: 200 });
    }
}