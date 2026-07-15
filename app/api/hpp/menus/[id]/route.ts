import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const menuId = parseInt(id, 10);

    // 1. Get menu detail
    const menuRes = await query(`
      SELECT 
        m.id, m.name, m.variant, m.display_name, m.sale_price, m.hpp
      FROM menus m
      WHERE m.id = $1
    `, [menuId]);

    const menu = menuRes.rows[0];
    if (!menu) return NextResponse.json({ error: 'Menu not found' }, { status: 404 });

    // 2. Get ingredients used in this menu's recipes across all venues
    const ingredientsRes = await query(`
      SELECT 
        ri.id, ri.quantity AS qty, ri.unit, 
        ri.cost_per_unit, ri.extension AS cost,
        i.name AS ingredient_name,
        r.venue_id
      FROM recipe_ingredients ri
      JOIN recipes r ON r.id = ri.recipe_id
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE r.menu_id = $1
      ORDER BY ri.sort_order, i.name
    `, [menuId]);

    return NextResponse.json({
      menu,
      ingredients: ingredientsRes.rows
    });
  } catch (err: any) {
    console.error('Error fetching menu detail:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const menuId = parseInt(id, 10);
    const { sale_price } = await req.json();

    if (typeof sale_price !== 'number') {
      return NextResponse.json({ error: 'Invalid sale_price' }, { status: 400 });
    }

    await query(`
      UPDATE menus
      SET sale_price = $1, updated_at = NOW()
      WHERE id = $2
    `, [sale_price, menuId]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error updating master menu price:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
