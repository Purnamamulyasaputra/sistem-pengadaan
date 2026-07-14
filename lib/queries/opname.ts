import { query, withTransaction } from '@/lib/db';
import { adjustStock } from './inventory';

export interface StockCountHeader {
  id: number;
  location_type: string;
  location_id?: number;
  location_name?: string;
  count_date: string;
  pic_id: number;
  pic_name?: string;
  status: string;
  total_value: number;
  general_notes?: string;
  created_at: string;
  updated_at: string;
}

export async function getStockCountHeaders(opts?: { locationType?: string; locationId?: number; status?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.locationType) { conditions.push(`sch.location_type = $${i++}`); params.push(opts.locationType); }
  if (opts?.locationId) { conditions.push(`sch.location_id = $${i++}`); params.push(opts.locationId); }
  if (opts?.status) { conditions.push(`sch.status = $${i++}`); params.push(opts.status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<StockCountHeader>(
    `SELECT sch.*, o.name AS location_name, u.name AS pic_name
     FROM stock_count_headers sch
     LEFT JOIN outlets o ON o.id = sch.location_id
     LEFT JOIN users u ON u.id = sch.pic_id
     ${where}
     ORDER BY sch.count_date DESC, sch.created_at DESC`,
    params
  );
  return result.rows;
}

export async function getStockCountDetails(headerId: number) {
  const result = await query(
    `SELECT scd.*, i.name AS item_name, c.name AS category_name, i.smallest_unit, i.current_average_price
     FROM stock_count_details scd
     LEFT JOIN items i ON i.id = scd.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE scd.header_id = $1
     ORDER BY c.name, i.name`,
    [headerId]
  );
  return result.rows;
}

export async function createStockCountSession(data: {
  location_type: string;
  location_id?: number;
  count_date: string;
  pic_id: number;
  general_notes?: string;
}) {
  const result = await query(
    `INSERT INTO stock_count_headers (location_type, location_id, count_date, pic_id, general_notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.location_type, data.location_id ?? null, data.count_date, data.pic_id, data.general_notes ?? null]
  );
  return result.rows[0];
}

export async function upsertStockCountDetail(data: {
  header_id: number;
  item_id: number;
  system_balance: number;
  actual_physical_qty: number;
  reason_category?: string;
  reason_notes?: string;
}) {
  const variance = data.actual_physical_qty - data.system_balance;

  // Get current avg price for monetary value
  const priceRes = await query(`SELECT current_average_price FROM items WHERE id = $1`, [data.item_id]);
  const avgPrice = parseFloat(priceRes.rows[0]?.current_average_price ?? '0');
  const valueAmount = Math.abs(variance) * avgPrice;

  const result = await query(
    `INSERT INTO stock_count_details (header_id, item_id, system_balance, actual_physical_qty, variance, reason_category, reason_notes, value_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (header_id, item_id)
     DO UPDATE SET actual_physical_qty = EXCLUDED.actual_physical_qty, variance = EXCLUDED.variance,
                   reason_category = EXCLUDED.reason_category, reason_notes = EXCLUDED.reason_notes,
                   value_amount = EXCLUDED.value_amount
     RETURNING *`,
    [data.header_id, data.item_id, data.system_balance, data.actual_physical_qty, variance,
     data.reason_category ?? null, data.reason_notes ?? null, valueAmount]
  );
  return result.rows[0];
}

export async function lockStockCount(headerId: number, locationType: string) {
  return withTransaction(async (client) => {
    const headerRes = await client.query(`SELECT * FROM stock_count_headers WHERE id = $1 FOR UPDATE`, [headerId]);
    const header = headerRes.rows[0];
    if (!header) throw new Error('Stock count session not found');
    if (header.status === 'LOCKED') throw new Error('Already locked');

    const detailsRes = await client.query(
      `SELECT * FROM stock_count_details WHERE header_id = $1`, [headerId]
    );

    let totalValue = 0;

    for (const detail of detailsRes.rows) {
      if (detail.variance !== 0) {
        if (locationType === 'PUSAT') {
          // Create ADJ mutation in inventory_logs
          await adjustStock({
            item_id: detail.item_id,
            qty_change: detail.variance,
            reference_id: headerId,
            client,
          });
        }
        totalValue += Math.abs(parseFloat(detail.value_amount ?? '0'));
      }
    }

    await client.query(
      `UPDATE stock_count_headers SET status = 'LOCKED', total_value = $1, updated_at = now() WHERE id = $2`,
      [totalValue, headerId]
    );

    return { success: true, totalValue };
  });
}

export async function submitStockCount(headerId: number) {
  const result = await query(
    `UPDATE stock_count_headers SET status = 'SUBMITTED', updated_at = now() WHERE id = $1 AND status = 'DRAFT' RETURNING *`,
    [headerId]
  );
  return result.rows[0] ?? null;
}

export async function getItemsForOpname(locationType: string, locationId?: number) {
  if (locationType === 'PUSAT') {
    return query(
      `SELECT i.id AS item_id, i.name AS item_name, i.smallest_unit, c.name AS category_name,
              i.current_average_price,
              COALESCE((SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1), 0) AS system_balance
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
       WHERE i.is_active = TRUE
       ORDER BY c.name, i.name`
    ).then(r => r.rows);
  } else if (locationType === 'OUTLET') {
    return query(
      `SELECT i.id AS item_id, i.name AS item_name, i.smallest_unit, c.name AS category_name,
              i.current_average_price,
              0 AS system_balance
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
       WHERE i.is_active = TRUE
       ORDER BY c.name, i.name`
    ).then(r => r.rows);
  }
  return [];
}
