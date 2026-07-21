import { getMokaToken, saveMokaToken } from '@/lib/queries/moka';

export async function fetchMokaAPI(endpoint: string, method: string = 'GET', body?: unknown) {
    const token = await getMokaToken();
    if (!token) throw new Error("Not connected to Moka");

    const baseUrl = 'https://api.mokapos.com';
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token.access_token}`,
        'Accept': 'application/json'
    };

    if (body) {
        headers['Content-Type'] = 'application/json';
    }

    let response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    // If Unauthorized, try to refresh the token
    if (response.status === 401) {
        console.log("Moka Access Token expired. Attempting refresh...");
        const clientId = process.env.MOKA_CLIENT_ID;
        const clientSecret = process.env.MOKA_CLIENT_SECRET;

        const refreshRes = await fetch('https://api.mokapos.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: token.refresh_token,
                grant_type: 'refresh_token'
            })
        });

        if (!refreshRes.ok) {
            console.error("Refresh token failed:", await refreshRes.text());
            throw new Error("auth_expired");
        }

        const data = await refreshRes.json();
        await saveMokaToken(data.access_token, data.refresh_token, data.expires_in, data.scope, data.created_at);
        console.log("Token successfully refreshed.");

        // Retry original request with new token
        headers['Authorization'] = `Bearer ${data.access_token}`;
        response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Moka API Error (${response.status}):`, errorText);
        throw new Error(`Moka API Error: ${response.status}`);
    }

    return response.json();
}
