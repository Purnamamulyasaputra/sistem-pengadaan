import { NextRequest, NextResponse } from 'next/server';

// POST: Receive client_id & client_secret from UI form, store in cookies, return Moka auth URL
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { client_id, client_secret } = body;

    if (!client_id || !client_secret) {
        return NextResponse.json({ error: 'client_id and client_secret are required' }, { status: 400 });
    }

    const redirectUri = process.env.MOKA_REDIRECT_URI;
    if (!redirectUri) {
        return NextResponse.json({ error: 'MOKA_REDIRECT_URI not configured' }, { status: 500 });
    }

    const scope = encodeURIComponent('profile library report transaction customer');
    const encodedRedirect = encodeURIComponent(redirectUri);
    const mokaAuthUrl = `https://api.mokapos.com/oauth/authorize?client_id=${client_id}&redirect_uri=${encodedRedirect}&response_type=code&scope=${scope}`;

    // Store credentials temporarily in HTTP-only cookies (10 minutes TTL)
    const response = NextResponse.json({ auth_url: mokaAuthUrl });
    response.cookies.set('moka_pending_client_id', client_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600,
        path: '/',
        sameSite: 'lax',
    });
    response.cookies.set('moka_pending_client_secret', client_secret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600,
        path: '/',
        sameSite: 'lax',
    });

    return response;
}

// GET: Legacy redirect support (kept for direct URL access)
export async function GET() {
    return NextResponse.json({ error: 'Use POST with client_id and client_secret' }, { status: 405 });
}
