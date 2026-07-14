import { query, withTransaction } from '@/lib/db';
import type { PoolClient } from 'pg';

export interface Item {
  id: number;
  name: string;
  category_id: number;
  category_name?: string;
  barcode?: string;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: number;
  minimum_threshold: number;
  threshold_type: string;
  computed_threshold_cache?: number;
  is_perishable: boolean;
  is_active: boolean;
  current_average_price: number;
  created_at: string;
  updated_at: string;
  is_hpp?: boolean;
  ingredient_id?: number;
  ingredient_name?: string;
}

export async function getItems(opts?: { categoryId?: string; search?: string; activeOnly?: boolean }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (opts?.activeOnly !== false) {
    conditions.push(`i.is_active = TRUE`);
  }
  if (opts?.categoryId) {
    conditions.push(`i.category_id = $${i++}`);
    params.push(Number(opts.categoryId));
  }
  if (opts?.search) {
    conditions.push(`i.name ILIKE $${i++}`);
    params.push(`%${opts.search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query<Item & { current_stock?: number }>(
    `SELECT i.*, c.name AS category_name,
            COALESCE((SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1), 0) AS current_stock,
            i.ingredient_id IS NOT NULL AS is_hpp,
            ing.name AS ingredient_name
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     LEFT JOIN ingredients ing ON ing.id = i.ingredient_id
     ${where}
     ORDER BY i.name`,
    params
  );
  return result.rows;
}

export async function getItemById(id: number) {
  const result = await query<Item>(
    `SELECT i.*, c.name AS category_name
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE i.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createItem(data: {
  name: string;
  category_id: number;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: number;
  minimum_threshold: number;
  threshold_type: string;
  is_perishable: boolean;
  barcode?: string;
  current_average_price?: number;
  ingredient_id?: number | null;
}) {
  const result = await query<Item>(
    `INSERT INTO items (name, category_id, purchase_unit, smallest_unit, conversion_ratio, minimum_threshold, threshold_type, is_perishable, barcode, current_average_price, ingredient_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [data.name, data.category_id, data.purchase_unit, data.smallest_unit, data.conversion_ratio, data.minimum_threshold, data.threshold_type, data.is_perishable, data.barcode ?? null, data.current_average_price ?? 0, data.ingredient_id ?? null]
  );
  return result.rows[0];
}

export async function updateItem(id: number, data: Partial<{
  name: string;
  category_id: number;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: number;
  minimum_threshold: number;
  threshold_type: string;
  is_perishable: boolean;
  is_active: boolean;
  barcode: string;
  current_average_price: number;
  ingredient_id: number | null;
}>) {
  const fields = Object.keys(data);
  if (!fields.length) return null;
  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = Object.values(data);
  const result = await query<Item>(
    `UPDATE items SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0] ?? null;
}

export async function deleteItem(id: number): Promise<boolean> {
  // 1. Validasi HPP (Mencegah penghapusan jika terdaftar sebagai resep)
  const hppCheck = await query(
    `SELECT ingredient_id IS NOT NULL AS is_hpp FROM items WHERE id = $1`,
    [id]
  );
  if (hppCheck.rows[0]?.is_hpp) {
    throw new Error('Penghapusan ditolak: Barang ini masih terdaftar secara aktif sebagai bahan resep di modul HPP.');
  }

  // 2. Cascade delete manual untuk riwayat transaksi pergudangan
  const tables = [
    'inventory_logs',
    'purchase_order_items',
    'delivery_order_items',
    'stock_opname_details',
    'outlet_request_items',
    'order_items'
  ];

  for (const tbl of tables) {
    try {
      await query(`DELETE FROM ${tbl} WHERE item_id = $1`, [id]);
    } catch (e) {
      // Abaikan jika tabel tidak ada
    }
  }

  const result = await query(`DELETE FROM items WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function generateBarcode(id: number): Promise<string> {
  const padded = String(id).padStart(6, '0');
  const code = `ERC${padded}`;
  await query(`UPDATE items SET barcode = $1, updated_at = now() WHERE id = $2`, [code, id]);
  return code;
}

export async function getCurrentStock(itemId: number, client?: PoolClient): Promise<number> {
  const q = client ? client.query.bind(client) : query;
  const result = await q(
    `SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [itemId]
  );
  return Number(result.rows[0]?.ending_balance ?? 0);
}
