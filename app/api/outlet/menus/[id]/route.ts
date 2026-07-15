import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_OUTLET' || !session.outletId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const menuId = parseInt(id, 10);
    const outletId = session.outletId;

    // 1. Get venues for this outlet
    const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
    const venueIds = venuesRes.rows.map(r => r.venue_id);
    if (!venueIds.length) return NextResponse.json({ error: 'No venues' }, { status: 403 });

    // 2. Get menu detail with overridden price
    const menuRes = await query(`
      SELECT 
        m.id, m.name, m.variant, m.display_name, m.sale_price AS master_price, m.hpp,
        COALESCE(omp.sale_price, m.sale_price) AS sale_price,
        (omp.sale_price IS NOT NULL) AS is_overridden
      FROM menus m
      LEFT JOIN outlet_menu_prices omp ON omp.menu_id = m.id AND omp.outlet_id = $1
      WHERE m.id = $2
    `, [outletId, menuId]);

    const menu = menuRes.rows[0];
    if (!menu) return NextResponse.json({ error: 'Menu not found' }, { status: 404 });

    // 3. Get ingredients used in this menu's recipes, restricted to the outlet's venues
    const ingredientsRes = await query(`
      SELECT 
        ri.id, ri.quantity AS qty, ri.unit, 
        ri.cost_per_unit, ri.extension AS cost,
        i.name AS ingredient_name
      FROM recipe_ingredients ri
      JOIN recipes r ON r.id = ri.recipe_id
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE r.menu_id = $1 AND r.venue_id = ANY($2)
      ORDER BY ri.sort_order, i.name
    `, [menuId, venueIds]);

    return NextResponse.json({
      menu,
      ingredients: ingredientsRes.rows
    });
  } catch (err: any) {
    console.error('Error fetching menu detail:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
