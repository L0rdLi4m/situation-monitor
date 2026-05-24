export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import https from 'node:https';

type State = [
    string, string | null, string, number | null, number | null,
        number | null, number | null, number | null, boolean,
        number | null, number | null, ...unknown[]
];

let cachedToken: { token: string; expires: number } | null = null;

function httpsRequest(
    url: string,
    options: https.RequestOptions = {},
    body?: string,
): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { timeout: 25000, ...options }, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy(new Error('Request timeout'));
        });
        if (body) req.write(body);
        req.end();
    });
}

async function getOpenSkyToken(): Promise<string | null> {
    const clientId = process.env.OPENSKY_CLIENT_ID;
    const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    if (cachedToken && Date.now() < cachedToken.expires) {
        return cachedToken.token;
    }

    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    }).toString();

    const { status, body: respBody } = await httpsRequest(
        'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body).toString(),
            },
        },
        body,
    );

    if (status !== 200) return null;
    const data = JSON.parse(respBody);
    cachedToken = {
        token: data.access_token,
        expires: Date.now() + 25 * 60 * 1000,
    };
    return data.access_token;
}

export async function GET(request: Request) {
    void request.url;

    try {
        const token = await getOpenSkyToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const { status, body } = await httpsRequest(
            'https://opensky-network.org/api/states/all',
            { method: 'GET', headers },
        );

        if (status !== 200) {
            return Response.json(
                { flights: [], error: `OpenSky ${status}` },
                { status: 200 },
            );
        }

        const data = JSON.parse(body);
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
        return Response.json(
            { flights: [], error: String(err instanceof Error ? err.message : err) },
            { status: 200 },
        );
    }
}