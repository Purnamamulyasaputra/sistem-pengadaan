import { NextRequest, NextResponse } from 'next/server';
import { syncItems } from '@/lib/queries/moka_sync';

export async function POST(request: NextRequest) {
    try {
        const result = await syncItems();
        
        if (result.success) {
            return NextResponse.json({ success: true, message: `Berhasil menarik ${result.count} menu dari Moka` });
        } else {
            return NextResponse.json({ success: false, message: result.message }, { status: 500 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message || 'Internal server error' }, { status: 500 });
    }
}
