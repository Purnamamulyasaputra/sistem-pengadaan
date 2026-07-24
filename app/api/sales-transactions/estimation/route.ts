import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.outletId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  const outletId = session.outletId;

  try {
    // 1. Get all mapped Moka Items (Variants) for this outlet and their recipes
    const mokaItemsRes = await query(`
      SELECT 
        mv.id as moka_item_id,
        CASE WHEN mv.name = 'Regular' OR mv.name IS NULL THEN mi.name ELSE mi.name || ' - ' || mv.name END as moka_item_name,
        mv.internal_recipe_id,
        r.yield_unit
      FROM moka_item_variants mv
      JOIN moka_items mi ON mv.item_id = mi.id
      LEFT JOIN recipes r ON r.id = mv.internal_recipe_id
      WHERE mi.outlet_id = $1 AND mv.internal_recipe_id IS NOT NULL
      ORDER BY moka_item_name
    `, [outletId]);

    const mokaItems = mokaItemsRes.rows;
    if (mokaItems.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 2. Get all recipe ingredients for the mapped recipes, joining with ingredients to get item_id
    const recipeIds = [...new Set(mokaItems.map(m => m.internal_recipe_id))];
    const ingredientsRes = await query(`
      SELECT 
        ri.recipe_id,
        ri.ingredient_id,
        ing.item_id,
        ri.quantity,
        i.name as ingredient_name,
        i.smallest_unit
      FROM recipe_ingredients ri
      JOIN ingredients ing ON ing.id = ri.ingredient_id
      LEFT JOIN items i ON i.id = ing.item_id
      WHERE ri.recipe_id = ANY($1::int[])
    `, [recipeIds]);

    const ingredients = ingredientsRes.rows;

    // 3. Get current stock for these inventory items at this outlet
    const itemIds = [...new Set(ingredients.map(i => i.item_id).filter(Boolean))];
    const stockRes = await query(`
      SELECT 
        item_id,
        COALESCE(current_balance, 0)::numeric AS current_balance
      FROM outlet_stocks
      WHERE outlet_id = $1 AND item_id = ANY($2::int[])
    `, [outletId, itemIds.length > 0 ? itemIds : [-1]]);

    const stockMap: Record<number, number> = {};
    for (const row of stockRes.rows) {
      stockMap[Number(row.item_id)] = Number(row.current_balance);
    }

    // 4. Calculate estimation per Moka Item
    const results = mokaItems.map(mi => {
      const recipeIngredients = ingredients.filter(i => i.recipe_id === mi.internal_recipe_id);
      
      let maxPortions = Infinity;
      
      if (recipeIngredients.length === 0) {
        maxPortions = 0;
      } else {
        for (const ing of recipeIngredients) {
          if (!ing.item_id) {
            maxPortions = 0;
            break;
          }
          const stock = Math.max(0, stockMap[Number(ing.item_id)] || 0);
          const needed = Number(ing.quantity);
          if (needed > 0) {
            const portions = Math.max(0, Math.floor(stock / needed));
            if (portions < maxPortions) {
              maxPortions = portions;
            }
          }
        }
      }

      const breakdown = recipeIngredients.map(ing => {
        const stock = Math.max(0, stockMap[Number(ing.item_id)] || 0);
        const needed = Number(ing.quantity);
        return {
          ingredient_name: ing.ingredient_name || 'Unknown',
          needed_per_portion: needed,
          current_stock: stock,
          unit: ing.smallest_unit || '',
          estimated_portions: needed > 0 ? Math.floor(stock / needed) : 0
        };
      });

      return {
        moka_item_id: mi.moka_item_id,
        name: mi.moka_item_name,
        estimated_portions: maxPortions,
        has_ingredients: recipeIngredients.length > 0,
        unit: mi.yield_unit || 'Pcs',
        breakdown
      };
    });

    // Sort by estimated_portions ASC, then name
    results.sort((a, b) => {
      if (a.estimated_portions !== b.estimated_portions) {
        return a.estimated_portions - b.estimated_portions;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error('Error in sales estimation:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
