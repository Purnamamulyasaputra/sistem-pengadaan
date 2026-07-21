import { NextRequest, NextResponse } from 'next/server';
import { deleteMokaTokens } from '@/lib/queries/moka';

export async function POST(request: NextRequest) {
    try {
        const success = await deleteMokaTokens();
        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Failed to disconnect from database' }, { status: 500 });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
