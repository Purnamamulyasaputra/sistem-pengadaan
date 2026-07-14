import { query, withTransaction } from '@/lib/db';
import type { PoolClient } from 'pg';
import { checkAndCreateAlert } from './alerts';

export interface InventoryLog {
  id: number;
  item_id: number;
  item_name?: string;
  movement_type: string;
  qty_change: number;
  ending_balance: number;
  reference_type: string;
  reference_id?: number;
  created_at: string;
}

export interface PriceHistory {
  id: number;
  item_id: number;
  item_name?: string;
  vendor_id?: number;
  vendor_name?: string;
  purchase_date: string;
  purchase_qty: number;
  unit_purchase_price: number;
  new_average_price: number;
  purchase_order_item_id?: number;
  created_at: string;
}

export async function receiveGoods(input: {
  item_id: number;
  qty: number;
  vendor_id: number;
  unit_purchase_price: number;
  purchase_order_item_id?: number;
}) {
  const { item_id, qty, vendor_id, unit_purchase_price, purchase_order_item_id } = input;

  return withTransaction(async (client) => {
    // 1. Get current average price & stock (row lock to secure against race conditions)
    const current = await client.query(
      `SELECT current_average_price,
              (SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1) AS last_balance
       FROM items WHERE id = $1 FOR UPDATE`,
      [item_id]
    );

    const oldAvg = parseFloat(current.rows[0]?.current_average_price ?? '0');
    const oldBalance = parseFloat(current.rows[0]?.last_balance ?? '0');

    // 2. Calculate Moving Average
    const oldValue = oldAvg * oldBalance;
    const newValue = unit_purchase_price * qty;
    const newBalance = oldBalance + qty;
    const newAvgPrice = newBalance > 0 ? (oldValue + newValue) / newBalance : 0;

    // 3. Update price cache in items
    await client.query(
      `UPDATE items SET current_average_price = $1, updated_at = now() WHERE id = $2`,
      [newAvgPrice, item_id]
    );

    // 4. Insert stock mutation log
    await client.query(
      `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
       VALUES ($1, 'IN', $2, $3, 'RECEIPT', $4)`,
      [item_id, qty, newBalance, null]
    );

    // 5. Insert price history
    await client.query(
      `INSERT INTO price_history (item_id, vendor_id, purchase_date, purchase_qty, unit_purchase_price, new_average_price, purchase_order_item_id)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)`,
      [item_id, vendor_id, qty, unit_purchase_price, newAvgPrice, purchase_order_item_id ?? null]
    );

    return { newAvgPrice, newBalance };
  });
}

export async function getInventoryCard(itemId: number, limit = 50, offset = 0) {
  const result = await query<InventoryLog>(
    `SELECT il.*, i.name AS item_name
     FROM inventory_logs il
     LEFT JOIN items i ON i.id = il.item_id
     WHERE il.item_id = $1
     ORDER BY il.created_at DESC
     LIMIT $2 OFFSET $3`,
    [itemId, limit, offset]
  );
  return result.rows;
}

export async function getPriceHistory(opts?: { itemId?: number; vendorId?: number; limit?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.itemId) { conditions.push(`ph.item_id = $${i++}`); params.push(opts.itemId); }
  if (opts?.vendorId) { conditions.push(`ph.vendor_id = $${i++}`); params.push(opts.vendorId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = opts?.limit ? `LIMIT $${i++}` : 'LIMIT 100';
  if (opts?.limit) params.push(opts.limit);

  const result = await query<any>(
    `SELECT ph.*, i.name AS item_name, i.purchase_unit, v.name AS vendor_name
     FROM price_history ph
     LEFT JOIN items i ON i.id = ph.item_id
     LEFT JOIN vendors v ON v.id = ph.vendor_id
     ${where}
     ORDER BY ph.purchase_date DESC, ph.created_at DESC
     ${limitClause}`,
    params
  );
  return result.rows;
}

export async function outboundStock(input: {
  item_id: number;
  qty: number;
  reference_type: string;
  reference_id?: number;
  distribution_price?: number;
}, client?: PoolClient) {
  const doQuery = client ? client.query.bind(client) : query;

  const balanceRes = await doQuery(
    `SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [input.item_id]
  );
  const currentBalance = parseFloat(balanceRes.rows[0]?.ending_balance ?? '0');
  const newBalance = currentBalance - input.qty;

  await doQuery(
    `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
     VALUES ($1, 'OUT', $2, $3, $4, $5)`,
    [input.item_id, -input.qty, newBalance, input.reference_type, input.reference_id ?? null]
  );

  // Check reorder point
  await checkAndCreateAlert(input.item_id, newBalance, client);

  return newBalance;
}

export async function adjustStock(input: {
  item_id: number;
  qty_change: number; // positive = surplus, negative = shortage
  reference_id: number;
  client: PoolClient;
}) {
  const { item_id, qty_change, reference_id, client } = input;

  const balanceRes = await client.query(
    `SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [item_id]
  );
  const currentBalance = parseFloat(balanceRes.rows[0]?.ending_balance ?? '0');
  const newBalance = currentBalance + qty_change;

  await client.query(
    `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
     VALUES ($1, 'ADJ', $2, $3, 'OPNAME_ADJUSTMENT', $4)`,
    [item_id, qty_change, newBalance, reference_id]
  );

  if (qty_change < 0) {
    await checkAndCreateAlert(item_id, newBalance, client);
  }

  return newBalance;
}

export async function getInventoryReport(month: number, year: number) {
  const result = await query(
    `SELECT 
       i.name AS item_name,
       c.name AS category_name,
       SUM(CASE WHEN il.movement_type = 'IN' THEN il.qty_change ELSE 0 END) AS total_in_qty,
       SUM(CASE WHEN il.movement_type = 'OUT' AND il.reference_type = 'BARCODE_SCAN' THEN ABS(il.qty_change) ELSE 0 END) AS total_distribution_qty,
       SUM(CASE WHEN il.movement_type = 'ADJ' THEN il.qty_change ELSE 0 END) AS total_adj_qty,
       i.current_average_price,
       (SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1) AS current_balance
     FROM inventory_logs il
     LEFT JOIN items i ON i.id = il.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE EXTRACT(MONTH FROM il.created_at) = $1
       AND EXTRACT(YEAR FROM il.created_at) = $2
     GROUP BY i.id, i.name, c.name, i.current_average_price
     ORDER BY c.name, i.name`,
    [month, year]
  );
  return result.rows;
}
