import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ count: 0 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since');

  try {
    let sql = `SELECT count(*)::int AS cnt FROM delivery_note_issues WHERE status = 'PENDING'`;
    const params: any[] = [];
    if (since) {
      sql += ` AND created_at > $1`;
      params.push(new Date(Number(since)).toISOString());
    }
    const res = await query(sql, params);
    return NextResponse.json({ count: res.rows[0]?.cnt ?? 0 });
  } catch (error) {
    return NextResponse.json({ count: 0 });
  }
}
