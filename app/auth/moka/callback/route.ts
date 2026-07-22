import { NextRequest, NextResponse } from 'next/server';
import { saveMokaToken } from '@/lib/queries/moka';

// Force Turbopack recompile for Multi-Account support
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.redirect(new URL('/settings/moka?error=no_code', request.url));
    }

    const clientId = process.env.MOKA_CLIENT_ID;
    const clientSecret = process.env.MOKA_CLIENT_SECRET;
    const redirectUri = process.env.MOKA_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        return NextResponse.redirect(new URL('/settings/moka?error=missing_env', request.url));
    }

    try {
        const response = await fetch('https://api.mokapos.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Moka token error:', data);
            return NextResponse.redirect(new URL('/settings/moka?error=moka_api_error', request.url));
        }

        // --- BARU: Ambil informasi Business ID & Nama dari Moka API ---
        let businessId = 0;
        let accountName = "Unknown Account";
        let accountEmail = "";
        
        try {
            const bizRes = await fetch('https://api.mokapos.com/v1/businesses', {
                headers: {
                    'Authorization': `Bearer ${data.access_token}`,
                    'Accept': 'application/json'
                }
            });
            const bizData = await bizRes.json();
            
            if (bizData && bizData.data && bizData.data.length > 0) {
                const primaryBiz = bizData.data[0];
                businessId = primaryBiz.id;
                accountName = primaryBiz.name;
                // Moka API might or might not return email here depending on the scope
                accountEmail = primaryBiz.email || ''; 
            }
        } catch (bizError) {
            console.error("Gagal mengambil info business dari Moka:", bizError);
            // Tetap lanjut meskipun gagal, meski sebaiknya ini tidak terjadi.
        }
        
        if (!businessId) {
            console.error("Business ID tidak ditemukan.");
            return NextResponse.redirect(new URL('/settings/moka?error=no_business_id', request.url));
        }

        const success = await saveMokaToken(
            data.access_token,
            data.refresh_token,
            data.expires_in,
            data.scope,
            data.created_at,
            businessId,
            accountName,
            accountEmail
        );

        if (!success) {
            return NextResponse.redirect(new URL('/settings/moka?error=db_error', request.url));
        }

        return NextResponse.redirect(new URL('/settings/moka?success=true', request.url));

    } catch (error) {
        console.error('Callback error:', error);
        return NextResponse.redirect(new URL('/settings/moka?error=internal_error', request.url));
    }
}
