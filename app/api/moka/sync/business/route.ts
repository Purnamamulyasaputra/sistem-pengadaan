import { NextRequest, NextResponse } from 'next/server';
import { syncBusinessAndOutlets } from '@/lib/queries/moka_sync';

export async function POST(request: NextRequest) {
    try {
        const result = await syncBusinessAndOutlets();
        
        if (result.success) {
            return NextResponse.json({ success: true, message: 'Business and outlets synchronized successfully' });
        } else {
            return NextResponse.json({ success: false, message: result.message }, { status: 500 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message || 'Internal server error' }, { status: 500 });
    }
}
