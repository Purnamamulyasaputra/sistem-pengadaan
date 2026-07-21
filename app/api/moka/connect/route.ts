import { redirect } from 'next/navigation';

export async function GET() {
    const clientId = process.env.MOKA_CLIENT_ID;
    const redirectUri = process.env.MOKA_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
        return new Response('MOKA_CLIENT_ID or MOKA_REDIRECT_URI not configured in .env', { status: 500 });
    }

    const scope = encodeURIComponent('profile library report transaction customer');
    const encodedRedirect = encodeURIComponent(redirectUri);

    const mokaAuthUrl = `https://api.mokapos.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=${scope}`;
    
    redirect(mokaAuthUrl);
}
