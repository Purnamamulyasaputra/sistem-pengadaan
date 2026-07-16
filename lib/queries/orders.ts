import { query, withTransaction } from '@/lib/db';
import type { PoolClient } from 'pg';

export interface Order {
  id: number;
  outlet_id: number;
  outlet_name?: string;
  order_date: string;
  delivery_date: string;
  status: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  item_id: number;
  item_name?: string;
  category_name?: string;
  purchase_unit?: string;
  smallest_unit?: string;
  conversion_ratio?: number;
  qty_request: number;
  additional_notes?: string;
  smallest_unit_qty?: number;
  fulfillment_status: string;
  distribution_price?: number;
  current_stock?: number;
  created_at: string;
  updated_at: string;
}

export async function getOrders(opts?: { outletId?: number; status?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.outletId) { conditions.push(`o.outlet_id = $${i++}`); params.push(opts.outletId); }
  if (opts?.status) { conditions.push(`o.status = $${i++}`); params.push(opts.status); }
  if (opts?.startDate) { conditions.push(`o.order_date >= $${i++}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`o.order_date <= $${i++}`); params.push(opts.endDate); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = opts?.limit ? `LIMIT $${i++} OFFSET $${i++}` : '';
  if (opts?.limit) { params.push(opts.limit); params.push(opts.offset ?? 0); }

  const result = await query<Order>(
    `SELECT o.*, outlet.name AS outlet_name, u.name AS created_by_name,
            COUNT(oi.id)::int AS item_count
     FROM orders o
     LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
     LEFT JOIN users u ON u.id = o.created_by
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${where}
     GROUP BY o.id, outlet.name, u.name
     ORDER BY o.created_at DESC
     ${limitClause}`,
    params
  );
  return result.rows;
}

export async function getPendingOrderCount() {
  const result = await query<{ count: string }>(`SELECT count(*) FROM orders WHERE status = 'PENDING'`);
  return parseInt(result.rows[0]?.count ?? '0', 10);
}


export async function getOrderById(id: number) {
  const orderResult = await query<Order>(
    `SELECT o.*, outlet.name AS outlet_name, u.name AS created_by_name
     FROM orders o
     LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
     LEFT JOIN users u ON u.id = o.created_by
     WHERE o.id = $1`,
    [id]
  );
  const order = orderResult.rows[0] ?? null;
  if (!order) return null;

  const itemsResult = await query<OrderItem>(
    `SELECT oi.*, i.name AS item_name, c.name AS category_name,
            i.purchase_unit, i.smallest_unit, i.conversion_ratio,
            (SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1) AS current_stock
     FROM order_items oi
     LEFT JOIN items i ON i.id = oi.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [id]
  );
  return { ...order, items: itemsResult.rows };
}

export async function createOrder(data: {
  outlet_id: number;
  order_date: string;
  delivery_date: string;
  created_by: number;
  items: Array<{ item_id: number; qty_request: number; additional_notes?: string }>;
}) {
  return withTransaction(async (client) => {
    const orderResult = await client.query(
      `INSERT INTO orders (outlet_id, order_date, delivery_date, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [data.outlet_id, data.order_date, data.delivery_date, data.created_by]
    );
    const order = orderResult.rows[0];

    for (const item of data.items) {
      const ratioRes = await client.query(
        `SELECT conversion_ratio FROM items WHERE id = $1`, [item.item_id]
      );
      const ratio = Number(ratioRes.rows[0]?.conversion_ratio ?? 1);
      const smallest_unit_qty = item.qty_request * ratio;

      await client.query(
        `INSERT INTO order_items (order_id, item_id, qty_request, additional_notes, smallest_unit_qty)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.item_id, Math.max(0.001, item.qty_request), item.additional_notes ?? null, smallest_unit_qty]
      );
    }

    return order;
  });
}

export async function getOrderRecap(opts?: { status?: string; outletId?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.status) { conditions.push(`o.status = $${i++}`); params.push(opts.status); }
  if (opts?.outletId) { conditions.push(`o.outlet_id = $${i++}`); params.push(opts.outletId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT o.id AS order_id, o.outlet_id, outlet.name AS outlet_name, o.order_date, o.delivery_date, o.status,
            oi.id AS order_item_id, oi.item_id, i.name AS item_name, i.purchase_unit, i.smallest_unit, i.conversion_ratio,
            oi.qty_request, oi.smallest_unit_qty, oi.additional_notes, oi.fulfillment_status, oi.item_status, oi.distribution_price,
            c.name AS category_name, i.current_average_price
     FROM orders o
     LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN items i ON i.id = oi.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     ${where}
     ORDER BY o.created_at DESC, outlet.name, i.name`,
    params
  );
  return result.rows;
}

export async function updateOrderItemStatus(
  orderItemId: number,
  updates: Partial<{ item_status: string; fulfillment_status: string; distribution_price: number }>
) {
  return withTransaction(async (client) => {
    const fields = Object.keys(updates);
    if (!fields.length) return null;
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = Object.values(updates);
    const result = await client.query(
      `UPDATE order_items SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
      [orderItemId, ...values]
    );
    const item = result.rows[0];
    if (item) await recalculateOrderStatus(item.order_id, client);
    return item;
  });
}

export async function recalculateOrderStatus(orderId: number, client: PoolClient) {
  const itemsRes = await client.query(
    `SELECT item_status FROM order_items WHERE order_id = $1`, [orderId]
  );
  const statuses = itemsRes.rows.map((r: { item_status: string }) => r.item_status);
  if (!statuses.length) return;

  let newStatus = 'PENDING';
  if (statuses.every((s: string) => s === 'SELESAI')) newStatus = 'COMPLETED';
  else if (statuses.every((s: string) => s === 'DIKIRIM' || s === 'SELESAI')) newStatus = 'SHIPPED';
  else if (statuses.some((s: string) => ['PROSES_BELANJA', 'READY_DI_GUDANG', 'DIKIRIM', 'SELESAI'].includes(s))) newStatus = 'PROCESSING';

  await client.query(
    `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2`,
    [newStatus, orderId]
  );
}
