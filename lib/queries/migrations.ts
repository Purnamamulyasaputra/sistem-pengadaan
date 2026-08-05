import { query } from '@/lib/db';

export async function migrateLastPurchasePrice() {
  await query(`
    ALTER TABLE items
      ADD COLUMN IF NOT EXISTS last_purchase_price NUMERIC(15,4) DEFAULT 0
  `);

  const backfill = await query(`
    UPDATE items i
    SET last_purchase_price = ph.unit_purchase_price / NULLIF(i.conversion_ratio, 0)
    FROM (
      SELECT DISTINCT ON (item_id)
        item_id,
        unit_purchase_price,
        purchase_date
      FROM price_history
      ORDER BY item_id, purchase_date DESC, id DESC
    ) ph
    WHERE ph.item_id = i.id
      AND i.last_purchase_price = 0
  `);

  const fallback = await query(`
    UPDATE items
    SET last_purchase_price = current_average_price
    WHERE last_purchase_price = 0
      AND current_average_price > 0
  `);

  const verify = await query(`
    SELECT COUNT(*) AS total_items,
           COUNT(NULLIF(last_purchase_price, 0)) AS items_with_price
    FROM items
  `);

  return {
    backfilled_from_price_history: backfill.rowCount,
    backfilled_from_avg_price: fallback.rowCount,
    verification: verify.rows[0],
  };
}

export async function migrateSatuanPrd() {
  await query(`
    ALTER TABLE items
      ADD COLUMN IF NOT EXISTS is_split_allowed BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS min_order_qty NUMERIC(10,2) NOT NULL DEFAULT 1.00,
      ADD COLUMN IF NOT EXISTS order_multiple NUMERIC(10,2) NOT NULL DEFAULT 1.00
  `);

  await query(`
    ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS conversion_ratio NUMERIC(10,2) NOT NULL DEFAULT 1.00
  `);

  await query(`
    ALTER TABLE delivery_note_items
      ADD COLUMN IF NOT EXISTS conversion_ratio NUMERIC(10,2) NOT NULL DEFAULT 1.00
  `);

  const bfOrderItems = await query(`
    UPDATE order_items oi
    SET conversion_ratio = COALESCE(i.conversion_ratio, 1.00)
    FROM items i
    WHERE oi.item_id = i.id
      AND oi.conversion_ratio = 1.00
      AND i.conversion_ratio > 1.00
  `);

  const bfDoItems = await query(`
    UPDATE delivery_note_items dni
    SET conversion_ratio = COALESCE(i.conversion_ratio, 1.00)
    FROM items i
    WHERE dni.item_id = i.id
      AND dni.conversion_ratio = 1.00
      AND i.conversion_ratio > 1.00
  `);

  return {
    backfilled_order_items: bfOrderItems.rowCount,
    backfilled_do_items: bfDoItems.rowCount,
  };
}

export async function migrateOrderStatusTemp() {
  await query(`
    UPDATE order_items oi
    SET item_status = 'SELESAI', updated_at = NOW()
    FROM delivery_note_items dni
    JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dni.order_item_id = oi.id
      AND dn.status = 'DITERIMA'
      AND oi.item_status != 'SELESAI'
  `);

  await query(`
    UPDATE orders o
    SET status = 'COMPLETED', updated_at = NOW()
    WHERE o.status NOT IN ('COMPLETED', 'DIBATALKAN')
      AND NOT EXISTS (
        SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id AND oi.item_status != 'SELESAI'
      )
      AND EXISTS (
        SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
      )
  `);

  await query(`
    UPDATE orders o
    SET status = 'SHIPPED', updated_at = NOW()
    WHERE o.status = 'PROCESSING'
      AND EXISTS (
        SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id AND oi.item_status = 'SELESAI'
      )
      AND EXISTS (
        SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id AND oi.item_status != 'SELESAI'
      )
  `);
}

export async function migrateDeliveryNotes() {
  await query(`ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS proof_image_url VARCHAR;`);
  await query(`ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS qty_received NUMERIC;`);
  await query(`ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS discrepancy_reason VARCHAR;`);
  await query(`ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS discrepancy_notes TEXT;`);
  await query(`ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS unique_barcode VARCHAR;`);
}

export async function migrateItemsPackage() {
  await query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS package_unit VARCHAR(50)`);
  await query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS package_qty INT`);
}
