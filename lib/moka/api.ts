import { getMokaToken, saveMokaToken } from '@/lib/queries/moka';

export async function refreshMokaToken(tokenObj: any) {
    if (!tokenObj || !tokenObj.business_id) {
        throw new Error("Cannot refresh token without business_id");
    }

    // Use per-account credentials stored in DB for Private App support
    // Falls back to env vars only if not stored (backward compatibility)
    const clientId = tokenObj.client_id || process.env.MOKA_CLIENT_ID;
    const clientSecret = tokenObj.client_secret || process.env.MOKA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(`Missing client credentials for business ${tokenObj.business_id}`);
    }

    const refreshRes = await fetch('https://api.mokapos.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: tokenObj.refresh_token,
            grant_type: 'refresh_token'
        })
    });

    if (!refreshRes.ok) {
        console.error(`Refresh token failed for business ${tokenObj.business_id}:`, await refreshRes.text());
        throw new Error("auth_expired");
    }

    const data = await refreshRes.json();
    await saveMokaToken(
        data.access_token,
        data.refresh_token,
        data.expires_in,
        data.scope,
        data.created_at,
        tokenObj.business_id,
        tokenObj.account_name,
        tokenObj.account_email,
        clientId,
        clientSecret
    );
    return data;
}

// BARU: Fungsi fetch menggunakan token spesifik (Untuk Sync Engine Multi-Akun)
export async function fetchMokaAPIWithToken(token: any, endpoint: string, method: string = 'GET', body?: unknown) {
    if (!token) throw new Error("Token is required for fetchMokaAPIWithToken");

    // Proactive token refresh (5 minutes buffer)
    if (token.moka_created_at && token.expires_in) {
        const nowUnix = Math.floor(Date.now() / 1000);
        const expiresAt = Number(token.moka_created_at) + Number(token.expires_in);
        if (nowUnix > expiresAt - 300) {
            console.log(`Moka Access Token proactively expired for business ${token.business_id}. Refreshing before request...`);
            const newData = await refreshMokaToken(token);
            token.access_token = newData.access_token;
            token.refresh_token = newData.refresh_token;
            console.log(`Token successfully refreshed proactively for business ${token.business_id}.`);
        }
    }

    const baseUrl = 'https://api.mokapos.com';
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

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

    // If Unauthorized, try to refresh the token as a fallback
    if (response.status === 401) {
        console.log(`Moka Access Token expired (401) for business ${token.business_id}. Attempting fallback refresh...`);
        const newData = await refreshMokaToken(token);
        
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${newData.access_token}`;
        response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Moka API Error (${response.status}) for business ${token.business_id}:`, errorText);
        throw new Error(`Moka API Error: ${response.status}`);
    }

    return response.json();
}

// LAMA: Backward compatibility (menggunakan sembarang 1 token)
export async function fetchMokaAPI(endpoint: string, method: string = 'GET', body?: unknown) {
    let token = await getMokaToken();
    if (!token) throw new Error("Not connected to Moka");
    
    return fetchMokaAPIWithToken(token, endpoint, method, body);
}
