import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_OUTLET' || !session.outletId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get venues assigned to this outlet
    const venues = await query('SELECT venue_id FROM outlet_venues WHERE outlet_id = $1', [session.outletId]);
    if (!venues.rows || venues.rows.length === 0) {
      return NextResponse.json({ recipes: [] });
    }
    const venueIds = venues.rows.map(r => r.venue_id);

    const recipes = await query(`
      SELECT r.id, r.name, r.yield, r.yield_unit, r.subtotal, r.total_cost, r.sale_price,
             v.name as venue_name, mc.name as category_name
      FROM recipes r
      JOIN venues v ON v.id = r.venue_id
      LEFT JOIN menus m ON m.id = r.menu_id
      LEFT JOIN menu_categories mc ON mc.id = m.category_id
      WHERE r.venue_id = ANY($1)
      ORDER BY v.name ASC, r.name ASC
    `, [venueIds]);

    return NextResponse.json({ recipes: recipes.rows });
  } catch (error: any) {
    console.error('Error fetching outlet menus:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
