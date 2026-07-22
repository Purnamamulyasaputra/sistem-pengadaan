import { NextRequest, NextResponse } from 'next/server';
import { saveMokaToken } from '@/lib/queries/moka';

// Force Turbopack recompile for Multi-Account Private App support
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.redirect(new URL('/settings/moka?error=no_code', request.url));
    }

    // Read per-account credentials stored in HTTP-only cookies during /api/moka/connect
    const clientId = request.cookies.get('moka_pending_client_id')?.value;
    const clientSecret = request.cookies.get('moka_pending_client_secret')?.value;
    const redirectUri = process.env.MOKA_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        console.error('Missing credentials in cookies or env:', { clientId: !!clientId, clientSecret: !!clientSecret, redirectUri: !!redirectUri });
        return NextResponse.redirect(new URL('/settings/moka?error=missing_credentials', request.url));
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

        // --- Ambil informasi Business ID & Nama dari Moka API ---
        let businessId = 0;
        let accountName = '';
        let accountEmail = '';

        try {
            const bizRes = await fetch('https://api.mokapos.com/v1/businesses', {
                headers: {
                    'Authorization': `Bearer ${data.access_token}`,
                    'Accept': 'application/json'
                }
            });
            const bizData = await bizRes.json();
            console.log('Moka /v1/businesses response:', JSON.stringify(bizData).substring(0, 500));

            if (bizData && bizData.data && bizData.data.length > 0) {
                const primaryBiz = bizData.data[0];
                businessId = primaryBiz.id;
                accountName = primaryBiz.name;
                accountEmail = primaryBiz.email || '';
            } else {
                // Fallback for Private Apps: try to get business_id from outlets API
                console.log('No business data found in /v1/businesses, trying /v1/outlets...');
                const outRes = await fetch('https://api.mokapos.com/v1/outlets', {
                    headers: {
                        'Authorization': `Bearer ${data.access_token}`,
                        'Accept': 'application/json'
                    }
                });
                const outData = await outRes.json();
                console.log('Moka /v1/outlets response:', JSON.stringify(outData).substring(0, 500));
                
                if (outData && outData.data && outData.data.length > 0) {
                    const primaryOut = outData.data[0];
                    businessId = primaryOut.business_id;
                    accountName = primaryOut.name ? `Account via ${primaryOut.name}` : 'Unknown Account';
                }
            }
        } catch (bizError) {
            console.error('Failed to fetch business info from Moka:', bizError);
        }

        if (!businessId) {
            console.error('Business ID not found in Moka response.');
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
            accountEmail,
            clientId,      // Store per-account credentials
            clientSecret
        );

        if (!success) {
            return NextResponse.redirect(new URL('/settings/moka?error=db_error', request.url));
        }

        // Clear the temporary credential cookies after successful save
        const redirectResponse = NextResponse.redirect(new URL('/settings/moka?success=true', request.url));
        redirectResponse.cookies.delete('moka_pending_client_id');
        redirectResponse.cookies.delete('moka_pending_client_secret');
        return redirectResponse;

    } catch (error) {
        console.error('Callback error:', error);
        return NextResponse.redirect(new URL('/settings/moka?error=internal_error', request.url));
    }
}
