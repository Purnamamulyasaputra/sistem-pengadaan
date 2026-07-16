import { query, withTransaction } from '@/lib/db';

export interface PurchaseOrder {
  id: number;
  po_number: string;
  vendor_id: number;
  vendor_name?: string;
  vendor_reference?: string;
  order_date: string;
  order_deadline?: string;
  confirmation_required: boolean;
  confirmation_days_before?: number;
  destination_outlet_id?: number;
  destination_outlet_name?: string;
  status: string;
  payment_terms?: string;
  incoterm?: string;
  internal_notes?: string;
  buyer_id: number;
  buyer_name?: string;
  stock_alert_id?: number;
  is_favorite: boolean;
  currency: string;
  subtotal: number;
  total_tax: number;
  total: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export async function getPurchaseOrders(opts?: { status?: string; vendorId?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.status) { conditions.push(`po.status = $${i++}`); params.push(opts.status); }
  if (opts?.vendorId) { conditions.push(`po.vendor_id = $${i++}`); params.push(opts.vendorId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<PurchaseOrder>(
    `SELECT po.*, v.name AS vendor_name, u.name AS buyer_name, o.name AS destination_outlet_name
     FROM purchase_orders po
     LEFT JOIN vendors v ON v.id = po.vendor_id
     LEFT JOIN users u ON u.id = po.buyer_id
     LEFT JOIN outlets o ON o.id = po.destination_outlet_id
     ${where}
     ORDER BY po.created_at DESC`,
    params
  );
  return result.rows;
}

export async function getPurchaseOrderById(id: number) {
  const poRes = await query<PurchaseOrder>(
    `SELECT po.*, v.name AS vendor_name, u.name AS buyer_name, o.name AS destination_outlet_name
     FROM purchase_orders po
     LEFT JOIN vendors v ON v.id = po.vendor_id
     LEFT JOIN users u ON u.id = po.buyer_id
     LEFT JOIN outlets o ON o.id = po.destination_outlet_id
     WHERE po.id = $1`,
    [id]
  );
  const po = poRes.rows[0] ?? null;
  if (!po) return null;

  const itemsRes = await query(
    `SELECT poi.*, i.name AS item_name, i.purchase_unit, i.smallest_unit
     FROM purchase_order_items poi
     LEFT JOIN items i ON i.id = poi.item_id
     WHERE poi.purchase_order_id = $1
     ORDER BY poi.sort_order, poi.id`,
    [id]
  );
  return { ...po, items: itemsRes.rows };
}

export async function generatePoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  let poNumber = '';
  let isUnique = false;
  
  while (!isUnique) {
    const random4 = Math.floor(1000 + Math.random() * 9000); // 1000 to 9999
    poNumber = `PO-${year}${random4}`;
    
    const res = await query(`SELECT id FROM purchase_orders WHERE po_number = $1`, [poNumber]);
    if (res.rows.length === 0) {
      isUnique = true;
    }
  }
  
  return poNumber;
}

export async function createPurchaseOrder(data: {
  vendor_id: number;
  vendor_reference?: string;
  order_date?: string;
  order_deadline?: string;
  confirmation_required?: boolean;
  confirmation_days_before?: number;
  destination_outlet_id?: number;
  deliver_to?: string;
  payment_terms?: string;
  incoterm?: string;
  internal_notes?: string;
  buyer_id: number;
  stock_alert_id?: number;
  currency?: string;
  created_by: number;
  items: Array<{
    line_type: string;
    item_id?: number;
    description?: string;
    qty?: number;
    package_qty?: number;
    package_unit?: string;
    unit_price?: number;
    tax_percent?: number;
    disc_percent?: number;
    purchase_unit?: string;
    package_inner_size?: number;
    conversion_ratio?: number;
    sort_order?: number;
  }>;
}) {
  return withTransaction(async (client) => {
    const poNumber = await generatePoNumber();

    const poRes = await client.query(
      `INSERT INTO purchase_orders (po_number, vendor_id, vendor_reference, order_date, order_deadline,
         confirmation_required, confirmation_days_before, destination_outlet_id, deliver_to, payment_terms, incoterm,
         internal_notes, buyer_id, stock_alert_id, currency, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [poNumber, data.vendor_id, data.vendor_reference || null, data.order_date || null, data.order_deadline || null,
       data.confirmation_required ?? true,
       data.confirmation_days_before || null, data.destination_outlet_id || null, data.deliver_to || null,
       data.payment_terms || null, data.incoterm || '— Not set —', data.internal_notes || null,
       data.buyer_id, data.stock_alert_id || null, data.currency || 'IDR', data.created_by]
    );
    const po = poRes.rows[0];

    let subtotal = 0;
    let totalTax = 0;
    for (let idx = 0; idx < data.items.length; idx++) {
      const item = data.items[idx];
      const q = item.qty ?? null;
      const up = item.unit_price ?? null;
      const d = item.disc_percent ?? 0;
      const t = item.tax_percent ?? 0;
      const lineSubtotal = ((q || 0) * (up || 0)) * (1 - d / 100);
      
      subtotal += lineSubtotal;
      totalTax += lineSubtotal * (t / 100);

      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, line_type, item_id, description, qty, package_qty, package_unit, purchase_unit, package_inner_size, conversion_ratio, unit_price, tax_percent, discount_percent, subtotal, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [po.id, item.line_type, item.item_id ?? null, item.description ?? null, item.qty ?? null,
         item.package_qty ?? null, item.package_unit ?? null, item.purchase_unit ?? null, item.package_inner_size ?? null, item.conversion_ratio ?? null, item.unit_price ?? null,
         item.tax_percent ?? 0, item.disc_percent ?? 0, lineSubtotal, item.sort_order ?? idx]
      );
    }

    const total = subtotal + totalTax;
    await client.query(
      `UPDATE purchase_orders SET subtotal = $1, total_tax = $2, total = $3 WHERE id = $4`,
      [subtotal, totalTax, total, po.id]
    );

    return { ...po, subtotal, total_tax: totalTax, total };
  });
}

export async function updatePurchaseOrder(id: number, data: Parameters<typeof createPurchaseOrder>[0]) {
  return withTransaction(async (client) => {
    const poRes = await client.query(
      `UPDATE purchase_orders SET vendor_id = $1, vendor_reference = $2, order_date = $3, order_deadline = $4,
         confirmation_required = $5, confirmation_days_before = $6, destination_outlet_id = $7, deliver_to = $8, payment_terms = $9, incoterm = $10,
         internal_notes = $11, updated_at = now()
       WHERE id = $12 RETURNING *`,
      [data.vendor_id, data.vendor_reference || null, data.order_date || null, data.order_deadline || null,
       data.confirmation_required ?? true,
       data.confirmation_days_before || null, data.destination_outlet_id || null, data.deliver_to || null,
       data.payment_terms || null, data.incoterm || '— Not set —', data.internal_notes || null, id]
    );
    const po = poRes.rows[0];

    // Clear existing items
    await client.query(`DELETE FROM purchase_order_items WHERE purchase_order_id = $1`, [id]);

    let subtotal = 0;
    let totalTax = 0;
    for (let idx = 0; idx < data.items.length; idx++) {
      const item = data.items[idx];
      const q = item.qty ?? null;
      const up = item.unit_price ?? null;
      const d = item.disc_percent ?? 0;
      const t = item.tax_percent ?? 0;
      const lineSubtotal = ((q || 0) * (up || 0)) * (1 - d / 100);
      
      subtotal += lineSubtotal;
      totalTax += lineSubtotal * (t / 100);

      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, line_type, item_id, description, qty, package_qty, package_unit, purchase_unit, package_inner_size, conversion_ratio, unit_price, tax_percent, discount_percent, subtotal, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [id, item.line_type, item.item_id ?? null, item.description ?? null, item.qty ?? null,
         item.package_qty ?? null, item.package_unit ?? null, item.purchase_unit ?? null, item.package_inner_size ?? null, item.conversion_ratio ?? null, item.unit_price ?? null,
         item.tax_percent ?? 0, item.disc_percent ?? 0, lineSubtotal, item.sort_order ?? idx]
      );
    }

    const total = subtotal + totalTax;
    await client.query(
      `UPDATE purchase_orders SET subtotal = $1, total_tax = $2, total = $3 WHERE id = $4`,
      [subtotal, totalTax, total, id]
    );

    return { ...po, subtotal, total_tax: totalTax, total };
  });
}

export async function updatePurchaseOrderStatus(id: number, status: string, userId: number = 1) {
  return withTransaction(async (client) => {
    const { rows: poRows } = await client.query(`SELECT status, destination_outlet_id, po_number FROM purchase_orders WHERE id = $1`, [id]);
    const po = poRows[0];
    if (!po) throw new Error('PO tidak ditemukan');

    if (po.status === 'SELESAI' && status === 'SELESAI') return po;

    const result = await client.query(
      `UPDATE purchase_orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (status === 'SELESAI') {
      const { rows: items } = await client.query(
        `SELECT poi.item_id, poi.qty, poi.unit_price, COALESCE(poi.conversion_ratio, i.conversion_ratio) as conversion_ratio, i.current_average_price, i.current_stock
         FROM purchase_order_items poi
         JOIN items i ON i.id = poi.item_id
         WHERE poi.purchase_order_id = $1 AND poi.line_type = 'product'`,
        [id]
      );

      for (const item of items) {
        if (!item.item_id) continue;
        const ratio = Number(item.conversion_ratio) || 1;
        const qtyPurchased = Number(item.qty) || 0;
        const unitPricePurchased = Number(item.unit_price) || 0;
        
        const addedQty = qtyPurchased * ratio;
        const newUnitPrice = unitPricePurchased / ratio; 

        const currentStock = Number(item.current_stock) || 0;
        const currentAvg = Number(item.current_average_price) || 0;
        
        const totalNewStock = currentStock + addedQty;
        let newAvgPrice = currentAvg;
        if (totalNewStock > 0) {
           newAvgPrice = ((currentStock * currentAvg) + (addedQty * newUnitPrice)) / totalNewStock;
        }

        await client.query(
          `INSERT INTO inventory_logs 
           (item_id, outlet_id, type, reference_type, reference_id, quantity, unit_price, previous_stock, new_stock, notes, created_by)
           VALUES ($1, $2, 'IN', 'PURCHASE', $3, $4, $5, $6, $7, $8, $9)`,
          [
            item.item_id, 
            po.destination_outlet_id || 1, 
            po.po_number, 
            addedQty, 
            newUnitPrice, 
            currentStock, 
            totalNewStock, 
            'Penerimaan dari PO Otomatis', 
            userId
          ]
        );

        await client.query(
          `UPDATE items SET current_stock = current_stock + $1, current_average_price = $2, updated_at = now() WHERE id = $3`,
          [addedQty, newAvgPrice, item.item_id]
        );
      }
    }

    return result.rows[0];
  });
}
