import { query, withTransaction } from '@/lib/db';
import { outboundStock } from './inventory';
import { checkAndCreateAlert } from './alerts';

export interface DeliveryNote {
  id: number;
  delivery_note_number: string;
  order_id: number | null;
  outlet_id: number;
  outlet_name?: string;
  delivery_date: string;
  driver_name?: string;
  recipient_name?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

let seqCache = 0;

export async function generateDeliveryNoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const res = await query(
    `SELECT COUNT(*)::int AS cnt FROM delivery_notes WHERE EXTRACT(YEAR FROM created_at) = $1`,
    [year]
  );
  const seq = (res.rows[0]?.cnt ?? 0) + 1 + seqCache;
  seqCache++;
  setTimeout(() => { seqCache = Math.max(0, seqCache - 1); }, 5000);
  return `SJ/${year}/${String(seq).padStart(5, '0')}`;
}

export async function createDeliveryNote(data: {
  order_id: number;
  outlet_id: number;
  driver_name?: string;
  delivery_date: string;
  items: Array<{ order_item_id: number; item_id: number; qty_shipped: number; price_at_shipment: number; keterangan?: string; is_additional?: boolean }>;
}) {
  return withTransaction(async (client) => {
    const noteNumber = await generateDeliveryNoteNumber();

    const dnRes = await client.query(
      `INSERT INTO delivery_notes (delivery_note_number, order_id, outlet_id, driver_name, delivery_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [noteNumber, data.order_id, data.outlet_id, data.driver_name ?? null, data.delivery_date]
    );
    const dn = dnRes.rows[0];

    for (const item of data.items) {
      // Validate physical stock
      const balRes = await client.query(
        `SELECT log.ending_balance, i.name as item_name, i.smallest_unit 
         FROM inventory_logs log
         JOIN items i ON i.id = log.item_id 
         WHERE log.item_id = $1 
         ORDER BY log.created_at DESC LIMIT 1`,
        [item.item_id]
      );
      const currentStock = parseFloat(balRes.rows[0]?.ending_balance ?? '0');
      const itemName = balRes.rows[0]?.item_name ?? 'Unknown Item';
      const smallestUnit = (balRes.rows[0]?.smallest_unit || '').toLowerCase();

      // Auto-detect central ratio: ml->Liter (÷1000), gr->Kg (÷1000), others->no conversion
      const centralRatio = (smallestUnit === 'ml' || smallestUnit === 'gr' || smallestUnit === 'g') ? 1000 : 1;
      const actualQtyShipped = item.qty_shipped * centralRatio;

      // Check reserved qty for pending/draft DOs
      const reservedRes = await client.query(
        `SELECT SUM(dni.qty_shipped) as reserved_qty
         FROM delivery_note_items dni
         JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
         WHERE dni.item_id = $1 AND dn.status IN ('DRAFT', 'PENDING') AND dni.scanned_out_at IS NULL`,
        [item.item_id]
      );
      const reservedStock = parseFloat(reservedRes.rows[0]?.reserved_qty ?? '0');
      const availableStock = currentStock - reservedStock;

      if (actualQtyShipped > availableStock) {
        throw new Error(`Stok ${itemName} tidak mencukupi. Dikirim: ${item.qty_shipped} (= ${actualQtyShipped} ${balRes.rows[0]?.smallest_unit}), Tersedia: ${(availableStock / centralRatio).toFixed(2)} ${centralRatio === 1000 ? (smallestUnit === 'ml' ? 'Liter' : 'Kg') : smallestUnit} (Tereservasi: ${reservedStock})`);
      }

      let finalOrderItemId: number | null = item.order_item_id;
      if (data.order_id && (item.is_additional || item.order_item_id < 0)) {
        const orderItemRes = await client.query(
          `INSERT INTO order_items (order_id, item_id, qty_request, item_status, fulfillment_status)
           VALUES ($1, $2, 0, 'COMPLETED', 'COMPLETELY_FULFILLED') RETURNING id`,
          [data.order_id, item.item_id]
        );
        finalOrderItemId = orderItemRes.rows[0].id;
      } else if (!data.order_id) {
        finalOrderItemId = null;
      }

      const uniqueBarcode = Date.now().toString().slice(-6) + Math.floor(1000 + Math.random() * 9000).toString();
      await client.query(
        `INSERT INTO delivery_note_items (delivery_note_id, order_item_id, item_id, qty_shipped, price_at_shipment, keterangan, unique_barcode)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [dn.id, finalOrderItemId, item.item_id, actualQtyShipped, item.price_at_shipment, item.keterangan || null, uniqueBarcode]
      );
    }

    if (data.order_id) {
      // Update order status to SHIPPED
      await client.query(`UPDATE orders SET status = 'SHIPPED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status != 'COMPLETED'`, [data.order_id]);
    }

    return dn;
  });
}

export async function getDeliveryNotes(opts?: { outletId?: number; status?: string; orderId?: number; limit?: number; offset?: number; search?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.outletId) { conditions.push(`dn.outlet_id = $${i++}`); params.push(opts.outletId); }
  if (opts?.status) { conditions.push(`dn.status = $${i++}`); params.push(opts.status); }
  if (opts?.orderId) { conditions.push(`dn.order_id = $${i++}`); params.push(opts.orderId); }
  if (opts?.search) { conditions.push(`dn.delivery_note_number ILIKE $${i++}`); params.push(`%${opts.search}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query<{ cnt: string }>(`SELECT count(*) as cnt FROM delivery_notes dn ${where}`, params);
  const total = parseInt(countRes.rows[0]?.cnt ?? '0', 10);

  let limitClause = '';
  if (opts?.limit !== undefined) {
    limitClause += ` LIMIT $${i++}`;
    params.push(opts.limit);
  }
  if (opts?.offset !== undefined) {
    limitClause += ` OFFSET $${i++}`;
    params.push(opts.offset);
  }

  const result = await query<DeliveryNote>(
    `SELECT dn.*, o.name AS outlet_name, 
            CASE WHEN ord.id IS NOT NULL THEN 'PO-' || EXTRACT(YEAR FROM ord.order_date) || '-' || LPAD(ord.id::text, 5, '0') ELSE NULL END AS order_number
     FROM delivery_notes dn
     LEFT JOIN outlets o ON o.id = dn.outlet_id
     LEFT JOIN orders ord ON ord.id = dn.order_id
     ${where}
     ORDER BY dn.created_at DESC
     ${limitClause}`,
    params
  );
  return { data: result.rows, total };
}

export async function getShippedDeliveryNoteCount(outletId: number, since?: string | null) {
  let sql = `SELECT count(*) FROM delivery_notes WHERE outlet_id = $1 AND status = 'DIKIRIM'`;
  const params: any[] = [outletId];
  if (since) {
    sql += ` AND created_at > $2`;
    params.push(new Date(Number(since)).toISOString());
  }
  const result = await query<{ count: string }>(sql, params);
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function getDeliveryNoteById(id: number) {
  const dnRes = await query<DeliveryNote>(
    `SELECT dn.*, o.name AS outlet_name, 
            CASE WHEN ord.id IS NOT NULL THEN 'PO-' || EXTRACT(YEAR FROM ord.order_date) || '-' || LPAD(ord.id::text, 5, '0') ELSE NULL END AS order_number
     FROM delivery_notes dn
     LEFT JOIN outlets o ON o.id = dn.outlet_id
     LEFT JOIN orders ord ON ord.id = dn.order_id
     WHERE dn.id = $1`,
    [id]
  );
  const dn = dnRes.rows[0] ?? null;
  if (!dn) return null;

  const itemsRes = await query(
    `SELECT dni.*, i.name AS item_name, i.barcode, i.smallest_unit, i.purchase_unit, i.conversion_ratio,
            oi.fulfillment_status, oi.item_status, oi.additional_notes
     FROM delivery_note_items dni
     LEFT JOIN items i ON i.id = dni.item_id
     LEFT JOIN order_items oi ON oi.id = dni.order_item_id
     WHERE dni.delivery_note_id = $1
     ORDER BY dni.id`,
    [id]
  );
  return { ...dn, items: itemsRes.rows };
}

export async function getDeliveryNoteByCode(code: string) {
  const dnRes = await query<DeliveryNote>(
    `SELECT dn.*, o.name AS outlet_name
     FROM delivery_notes dn
     LEFT JOIN outlets o ON o.id = dn.outlet_id
     WHERE dn.delivery_note_number = $1`,
    [code]
  );
  const dn = dnRes.rows[0] ?? null;
  if (!dn) return null;

  const itemsRes = await query(
    `SELECT dni.*, i.name AS item_name, i.barcode, i.smallest_unit, i.purchase_unit, i.conversion_ratio,
            oi.fulfillment_status, oi.item_status, oi.additional_notes
     FROM delivery_note_items dni
     LEFT JOIN items i ON i.id = dni.item_id
     LEFT JOIN order_items oi ON oi.id = dni.order_item_id
     WHERE dni.delivery_note_id = $1
     ORDER BY dni.id`,
    [dn.id]
  );
  return { ...dn, items: itemsRes.rows };
}

export async function processPublicReceive(data: {
  delivery_note_id: number;
  recipient_name: string;
  proof_image_url?: string;
  items: Array<{
    delivery_note_item_id: number;
    qty_received: number;
    receive_notes: string;
    has_issue?: boolean;
    qty_issue?: number;
    issue_reason?: string;
    issue_photo_url?: string;
  }>;
}) {
  return withTransaction(async (client) => {
    // Update delivery note to DITERIMA
    await client.query(
      `UPDATE delivery_notes SET status = 'DITERIMA', recipient_name = $1, proof_image_url = $2, updated_at = now() WHERE id = $3`,
      [data.recipient_name, data.proof_image_url || null, data.delivery_note_id]
    );

    // Update Delivery Note Items
    for (const item of data.items) {
      const unitRes = await client.query(
        `SELECT i.smallest_unit FROM delivery_note_items dni 
         JOIN items i ON i.id = dni.item_id 
         WHERE dni.id = $1`, [item.delivery_note_item_id]
      );
      const smallestUnit = (unitRes.rows[0]?.smallest_unit || '').toLowerCase();
      const centralRatio = (smallestUnit === 'ml' || smallestUnit === 'gr' || smallestUnit === 'g') ? 1000 : 1;
      const actualQtyReceived = item.qty_received * centralRatio;
      const actualQtyIssue = (item.qty_issue || 0) * centralRatio;

      const updateRes = await client.query(
        `UPDATE delivery_note_items 
         SET scanned_in_at = NOW(), 
             qty_received = $1, 
             receive_notes = $2 
         WHERE delivery_note_id = $3 AND id = $4
         RETURNING id`,
        [actualQtyReceived, item.receive_notes || null, data.delivery_note_id, item.delivery_note_item_id]
      );

      const dniId = updateRes.rows[0]?.id;

      if (dniId && item.has_issue && actualQtyIssue > 0) {
        await client.query(
          `INSERT INTO delivery_note_issues 
           (delivery_note_item_id, qty_issue, reason, photo_url, status) 
           VALUES ($1, $2, $3, $4, 'PENDING')`,
          [dniId, actualQtyIssue, item.issue_reason || '', item.issue_photo_url || '']
        );
      }
    }

    // Update order items to SELESAI and update outlet stock
    const dnRes = await client.query(
      `SELECT order_id, outlet_id FROM delivery_notes WHERE id = $1`,
      [data.delivery_note_id]
    );
    const orderId = dnRes.rows[0]?.order_id;
    const outletId = dnRes.rows[0]?.outlet_id;

    if (orderId) {
      // Mark all order items for this delivery as SELESAI
      await client.query(
        `UPDATE order_items SET item_status = 'SELESAI', updated_at = NOW()
         WHERE order_id = $1 AND id = ANY(
           SELECT order_item_id FROM delivery_note_items WHERE delivery_note_id = $2
         )`,
        [orderId, data.delivery_note_id]
      );

      // Check if ALL order items across the entire order are SELESAI
      const pendingItemsRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM order_items 
         WHERE order_id = $1 AND item_status != 'SELESAI'`,
        [orderId]
      );
      if (pendingItemsRes.rows[0]?.cnt === 0) {
        await client.query(
          `UPDATE orders SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
          [orderId]
        );
      } else {
        // Partially completed — mark as SHIPPED if still PROCESSING
        await client.query(
          `UPDATE orders SET status = 'SHIPPED', updated_at = NOW() 
           WHERE id = $1 AND status = 'PROCESSING'`,
          [orderId]
        );
      }
    }

    // Update outlet stock for each received item
    if (outletId) {
      for (const item of data.items) {
        // Get item_id and actual received quantity from delivery_note_items
        const itemRes = await client.query(
          `SELECT item_id, qty_received FROM delivery_note_items 
           WHERE delivery_note_id = $1 AND id = $2`,
          [data.delivery_note_id, item.delivery_note_item_id]
        );
        const itemId = itemRes.rows[0]?.item_id;
        const actualQtyReceived = itemRes.rows[0]?.qty_received || 0;
        if (!itemId || actualQtyReceived <= 0) continue;

        // Atomic transfer: Deduct from central warehouse
        const balRes = await client.query(
          `SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [itemId]
        );
        const centralOldBalance = parseFloat(balRes.rows[0]?.ending_balance ?? '0');
        const centralNewBalance = centralOldBalance - actualQtyReceived;
        await client.query(
          `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
           VALUES ($1, 'OUT', $2, $3, 'PUBLIC_RECEIVE', $4)`,
          [itemId, -actualQtyReceived, centralNewBalance, data.delivery_note_id]
        );

        const stockRes = await client.query(
          `SELECT current_balance FROM outlet_stocks 
           WHERE outlet_id = $1 AND item_id = $2 FOR UPDATE`,
          [outletId, itemId]
        );

        if (stockRes.rows.length > 0) {
          const newBalance = parseFloat(stockRes.rows[0].current_balance) + actualQtyReceived;
          await client.query(
            `UPDATE outlet_stocks SET current_balance = $1, updated_at = NOW() 
             WHERE outlet_id = $2 AND item_id = $3`,
            [newBalance, outletId, itemId]
          );
          await client.query(
            `INSERT INTO outlet_inventory_logs (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
             VALUES ($1, $2, 'IN', $3, $4, 'PUBLIC_RECEIVE', $5)`,
            [outletId, itemId, actualQtyReceived, newBalance, data.delivery_note_id]
          );
        } else {
          await client.query(
            `INSERT INTO outlet_stocks (outlet_id, item_id, current_balance, updated_at) VALUES ($1, $2, $3, NOW())`,
            [outletId, itemId, actualQtyReceived]
          );
          await client.query(
            `INSERT INTO outlet_inventory_logs (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
             VALUES ($1, $2, 'IN', $3, $3, 'PUBLIC_RECEIVE', $4)`,
            [outletId, itemId, actualQtyReceived, data.delivery_note_id]
          );
        }
      }
    }
  });
}


export async function recordScan(data: {
  delivery_note_item_id: number;
  item_id: number;
  barcode_scanned: string;
  scan_type: 'OUT' | 'IN';
  scanned_by: number;
  device_info?: string;
  qty_received?: number;
  discrepancy_reason?: string;
  discrepancy_notes?: string;
}) {
  return withTransaction(async (client) => {
    // Get DN item details early for validation
    const dniRes = await client.query(
      `SELECT * FROM delivery_note_items WHERE id = $1`, [data.delivery_note_item_id]
    );
    const dni = dniRes.rows[0];
    if (!dni) throw new Error('Delivery item not found');

    // Validate barcode
    if (dni.unique_barcode) {
      if (dni.unique_barcode !== data.barcode_scanned) {
        throw new Error(`Error: Invalid unique tracking code.`);
      }
    } else {
      // Legacy fallback
      const itemRes = await client.query(`SELECT barcode FROM items WHERE id = $1`, [data.item_id]);
      const expectedBarcode = itemRes.rows[0]?.barcode;
      if (expectedBarcode && expectedBarcode !== data.barcode_scanned) {
        throw new Error(`Error: Scanned barcode does not match.`);
      }
    }

    // Check not already scanned
    const existingRes = await client.query(
      `SELECT id FROM barcode_scan_logs WHERE delivery_note_item_id = $1 AND scan_type = $2`,
      [data.delivery_note_item_id, data.scan_type]
    );
    if (existingRes.rows.length > 0) {
      throw new Error(`Item already scanned ${data.scan_type}`);
    }

    // Insert scan log
    await client.query(
      `INSERT INTO barcode_scan_logs (delivery_note_item_id, item_id, barcode_scanned, scan_type, scanned_by, device_info)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [data.delivery_note_item_id, data.item_id, data.barcode_scanned, data.scan_type, data.scanned_by, data.device_info ?? null]
    );

    // DN details already fetched above

    if (data.scan_type === 'OUT') {
      // Update scanned_out_at
      await client.query(
        `UPDATE delivery_note_items SET scanned_out_at = now(), scanned_out_by = $1 WHERE id = $2`,
        [data.scanned_by, data.delivery_note_item_id]
      );

      // Update order item status to DIKIRIM
      await client.query(
        `UPDATE order_items SET item_status = 'DIKIRIM', distribution_price = $1, updated_at = now() WHERE id = $2`,
        [dni.price_at_shipment, dni.order_item_id]
      );

      // Check if all items in DN have been scanned out
      const pendingRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM delivery_note_items WHERE delivery_note_id = $1 AND scanned_out_at IS NULL`,
        [dni.delivery_note_id]
      );
      if (pendingRes.rows[0]?.cnt === 0) {
        await client.query(
          `UPDATE delivery_notes SET status = 'DIKIRIM', updated_at = now() WHERE id = $1`,
          [dni.delivery_note_id]
        );
      }

    } else if (data.scan_type === 'IN') {
      // Update scanned_in_at and discrepancy fields
      const qty_recv = data.qty_received ?? dni.qty_shipped;
      await client.query(
        `UPDATE delivery_note_items SET 
         scanned_in_at = now(), scanned_in_by = $1,
         qty_received = $2, discrepancy_reason = $3, discrepancy_notes = $4
         WHERE id = $5`,
        [data.scanned_by, qty_recv, data.discrepancy_reason || null, data.discrepancy_notes || null, data.delivery_note_item_id]
      );

      // CREATE ISSUE TICKET IF DISCREPANCY EXISTS
      if (qty_recv < dni.qty_shipped) {
         const qty_issue = dni.qty_shipped - qty_recv;
         await client.query(
           `INSERT INTO delivery_note_issues 
            (delivery_note_item_id, qty_issue, reason, photo_url, status) 
            VALUES ($1, $2, $3, $4, 'PENDING')`,
           [data.delivery_note_item_id, qty_issue, data.discrepancy_reason || 'Barang tidak lengkap', '']
         );
      }

      // Increase outlet stock
      const dnRes = await client.query(`SELECT outlet_id FROM delivery_notes WHERE id = $1`, [dni.delivery_note_id]);
      const outletId = dnRes.rows[0].outlet_id;

      const stockRes = await client.query(
        `SELECT current_balance FROM outlet_stocks WHERE outlet_id = $1 AND item_id = $2 FOR UPDATE`,
        [outletId, data.item_id]
      );

      let oldBalance = 0;
      if (stockRes.rows.length > 0) {
        oldBalance = parseFloat(stockRes.rows[0].current_balance);
        const newBalance = oldBalance + qty_recv;
        await client.query(
          `UPDATE outlet_stocks SET current_balance = $1, updated_at = NOW() WHERE outlet_id = $2 AND item_id = $3`,
          [newBalance, outletId, data.item_id]
        );
      } else {
        await client.query(
          `INSERT INTO outlet_stocks (outlet_id, item_id, current_balance, updated_at) VALUES ($1, $2, $3, NOW())`,
          [outletId, data.item_id, qty_recv]
        );
      }

      const logBalance = oldBalance + qty_recv;
      await client.query(
        `INSERT INTO outlet_inventory_logs (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         VALUES ($1, $2, 'IN', $3, $4, 'BARCODE_SCAN', $5)`,
        [outletId, data.item_id, qty_recv, logBalance, data.delivery_note_item_id]
      );

      // Update order item status to SELESAI
      await client.query(
        `UPDATE order_items SET item_status = 'SELESAI', updated_at = now() WHERE id = $1`,
        [dni.order_item_id]
      );

    }

    return { success: true };
  });
}

export async function confirmReceipt(deliveryNoteId: number, recipientName: string, proofImageUrl?: string) {
  return withTransaction(async (client) => {
    // Check all items scanned in
    const pendingRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM delivery_note_items WHERE delivery_note_id = $1 AND scanned_in_at IS NULL`,
      [deliveryNoteId]
    );
    if (pendingRes.rows[0]?.cnt > 0) {
      throw new Error('Not all items have been scanned IN yet');
    }

    await client.query(
      `UPDATE delivery_notes SET status = 'DITERIMA', recipient_name = $1, proof_image_url = $2, updated_at = now() WHERE id = $3`,
      [recipientName, proofImageUrl || null, deliveryNoteId]
    );

    // Update all related order items to SELESAI
    const orderRes = await client.query(
      `SELECT order_id FROM delivery_notes WHERE id = $1`, [deliveryNoteId]
    );
    const orderId = orderRes.rows[0]?.order_id;
    if (orderId) {
      await client.query(
        `UPDATE order_items SET item_status = 'SELESAI', updated_at = now()
         WHERE order_id = $1 AND item_status = 'DIKIRIM'`,
        [orderId]
      );
      await client.query(
        `UPDATE orders SET status = 'COMPLETED', updated_at = now() WHERE id = $1`,
        [orderId]
      );
    }

    return { success: true };
  });
}

export async function cancelDeliveryNote(deliveryNoteId: number) {
  return withTransaction(async (client) => {
    // Check if it can be canceled
    const dnRes = await client.query(`SELECT status FROM delivery_notes WHERE id = $1`, [deliveryNoteId]);
    const dn = dnRes.rows[0];
    if (!dn) throw new Error('Delivery Note not found');
    if (dn.status !== 'DRAFT') {
      throw new Error('Only DRAFT Delivery Orders can be canceled.');
    }

    await client.query(
      `UPDATE delivery_notes SET status = 'CANCELED', updated_at = now() WHERE id = $1`,
      [deliveryNoteId]
    );

    return { success: true };
  });
}
export async function processShipAll(deliveryNoteId: number, adminId: number) {
  return withTransaction(async (client) => {
    // 1. Get all unscanned items
    const itemsRes = await client.query(
      `SELECT id, item_id, qty_shipped, order_item_id, price_at_shipment 
       FROM delivery_note_items 
       WHERE delivery_note_id = $1 AND scanned_out_at IS NULL`,
      [deliveryNoteId]
    );

    for (const dni of itemsRes.rows) {
      // Update scanned_out_at
      await client.query(
        `UPDATE delivery_note_items SET scanned_out_at = now(), scanned_out_by = $1 WHERE id = $2`,
        [adminId, dni.id]
      );

      // Update order item status to DIKIRIM
      await client.query(
        `UPDATE order_items SET item_status = 'DIKIRIM', distribution_price = $1, updated_at = now() WHERE id = $2`,
        [dni.price_at_shipment, dni.order_item_id]
      );
    }

    // Mark DN as DIKIRIM
    await client.query(
      `UPDATE delivery_notes SET status = 'DIKIRIM', updated_at = now() WHERE id = $1`,
      [deliveryNoteId]
    );

    return { success: true };
  });
}

export async function bulkRecordScan(data: {
  delivery_note_id: number;
  scan_type: 'OUT' | 'IN';
  scanned_by: number;
}) {
  return withTransaction(async (client) => {
    const dnItemsRes = await client.query(
      `SELECT * FROM delivery_note_items WHERE delivery_note_id = $1`, [data.delivery_note_id]
    );
    const items = dnItemsRes.rows;
    let processed_count = 0;

    for (const dni of items) {
      if (data.scan_type === 'OUT' && !dni.scanned_out_at) {
        // update dni
        await client.query(`UPDATE delivery_note_items SET scanned_out_at = now(), scanned_out_by = $1 WHERE id = $2`, [data.scanned_by, dni.id]);
        // update order item
        await client.query(`UPDATE order_items SET item_status = 'DIKIRIM', distribution_price = $1, updated_at = now() WHERE id = $2`, [dni.price_at_shipment, dni.order_item_id]);
        processed_count++;
      } else if (data.scan_type === 'IN' && !dni.scanned_in_at) {
        // update dni
        const qty_recv = dni.qty_shipped;
        await client.query(
          `UPDATE delivery_note_items SET scanned_in_at = now(), scanned_in_by = $1, qty_received = $2 WHERE id = $3`,
          [data.scanned_by, qty_recv, dni.id]
        );

        // Increase outlet stock
        const dnRes = await client.query(`SELECT outlet_id FROM delivery_notes WHERE id = $1`, [data.delivery_note_id]);
        const outletId = dnRes.rows[0].outlet_id;

        const stockRes = await client.query(
          `SELECT current_balance FROM outlet_stocks WHERE outlet_id = $1 AND item_id = $2 FOR UPDATE`,
          [outletId, dni.item_id]
        );

        let oldBalance = 0;
        if (stockRes.rows.length > 0) {
          oldBalance = parseFloat(stockRes.rows[0].current_balance);
          const newBalance = oldBalance + qty_recv;
          await client.query(
            `UPDATE outlet_stocks SET current_balance = $1, updated_at = NOW() WHERE outlet_id = $2 AND item_id = $3`,
            [newBalance, outletId, dni.item_id]
          );
        } else {
          await client.query(
            `INSERT INTO outlet_stocks (outlet_id, item_id, current_balance, updated_at) VALUES ($1, $2, $3, NOW())`,
            [outletId, dni.item_id, qty_recv]
          );
        }

        const logBalance = oldBalance + qty_recv;
        await client.query(
          `INSERT INTO outlet_inventory_logs (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
           VALUES ($1, $2, 'IN', $3, $4, 'BARCODE_SCAN', $5)`,
          [outletId, dni.item_id, qty_recv, logBalance, dni.id]
        );

        // update order item
        await client.query(`UPDATE order_items SET item_status = 'SELESAI', updated_at = now() WHERE id = $1`, [dni.order_item_id]);
        processed_count++;
      }
    }

    if (processed_count > 0) {
      if (data.scan_type === 'OUT') {
        await client.query(`UPDATE delivery_notes SET status = 'DIKIRIM', updated_at = now() WHERE id = $1`, [data.delivery_note_id]);
      } else if (data.scan_type === 'IN') {
        await client.query(`UPDATE delivery_notes SET status = 'DITERIMA', updated_at = now() WHERE id = $1`, [data.delivery_note_id]);

        // Check if all items in the related order are completed
        const orderRes = await client.query(`SELECT order_id FROM delivery_notes WHERE id = $1`, [data.delivery_note_id]);
        if (orderRes.rows.length > 0) {
          const orderId = orderRes.rows[0].order_id;
          await client.query(`UPDATE orders SET status = 'COMPLETED', updated_at = now() WHERE id = $1`, [orderId]);
        }
      }
    }

    return { success: true, processed_count };
  });
}

export async function getDeliveryNoteIssues(status?: string) {
  let q = `
    SELECT i.*, 
          dni.delivery_note_id, dni.qty_shipped, dni.qty_received,
          dn.delivery_note_number, dn.proof_image_url AS dn_proof_url, o.name AS outlet_name,
          it.name AS item_name, it.purchase_unit, it.conversion_ratio, it.smallest_unit
    FROM delivery_note_issues i
    JOIN delivery_note_items dni ON i.delivery_note_item_id = dni.id
    JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
    JOIN outlets o ON dn.outlet_id = o.id
    JOIN items it ON dni.item_id = it.id
  `;
  const params: unknown[] = [];
  if (status) {
    if (status === 'RESOLVED') {
      q += ` WHERE i.status != 'PENDING'`;
    } else {
      q += ` WHERE i.status = $1`;
      params.push(status);
    }
  }
  q += ` ORDER BY i.reported_at DESC`;

  const res = await query(q, params);
  return res.rows;
}

export async function resolveDeliveryNoteIssue(issueId: number, action: 'REPLACE' | 'WRITE_OFF', resolvedBy: number, notes: string) {
  return withTransaction(async (client) => {
    // Get the issue
    const issueRes = await client.query(
      `SELECT i.*, dni.item_id, dni.delivery_note_id, dn.outlet_id, dn.order_id 
       FROM delivery_note_issues i
       JOIN delivery_note_items dni ON i.delivery_note_item_id = dni.id
       JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
       WHERE i.id = $1 FOR UPDATE`,
      [issueId]
    );
    const issue = issueRes.rows[0];
    if (!issue) throw new Error('Issue not found');
    if (issue.status !== 'PENDING') throw new Error('Issue is already resolved');

    const newStatus = action === 'REPLACE' ? 'APPROVED_REPLACE' : 'APPROVED_WRITE_OFF';

    // Update issue
    await client.query(
      `UPDATE delivery_note_issues 
       SET status = $1, resolved_at = NOW(), resolved_by = $2, resolution_notes = $3
       WHERE id = $4`,
      [newStatus, resolvedBy, notes, issueId]
    );

    if (action === 'WRITE_OFF') {
      // Just record a loss in central warehouse (assuming central already deducted during OUT scan, wait, we don't deduct central again, the stock is just gone. 
      // Actually, if it was scanned out, central stock is already deducted. The outlet just didn't get it.
      // So no inventory logs needed. The stock is simply written off from the "in-transit" state.)
      // Wait, is there any stock adjustment needed?
      // When it was OUT, Central stock decreased by 10.
      // When it was IN, Outlet stock increased by 8.
      // The remaining 2 is currently nowhere. If we WRITE_OFF, it just stays nowhere. No stock action needed.
    } else if (action === 'REPLACE') {
      // Create a new DO Draft for the replacement.
      // We need to create a new DO linked to the same order.
      // 1. Generate new DO number
      const noRes = await client.query(`
        SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(delivery_note_number, '^SJ/\\d{4}/', '') AS INTEGER)), 0) + 1 AS next_seq
        FROM delivery_notes WHERE delivery_note_number LIKE 'SJ/' || to_char(now(), 'YYYY') || '/%'
      `);
      const nextSeq = noRes.rows[0].next_seq;
      const year = new Date().getFullYear();
      const dnNumber = `SJ/${year}/${String(nextSeq).padStart(5, '0')}`;

      // 2. Insert new DN
      const newDnRes = await client.query(
        `INSERT INTO delivery_notes (delivery_note_number, outlet_id, order_id, delivery_date, status)
         VALUES ($1, $2, $3, CURRENT_DATE, 'DRAFT') RETURNING id`,
        [dnNumber, issue.outlet_id, issue.order_id]
      );
      const newDnId = newDnRes.rows[0].id;

      // 3. Insert DN item
      // We need the order_item_id. Let's get it.
      const oiRes = await client.query(
        `SELECT order_item_id, price_at_shipment FROM delivery_note_items WHERE id = $1`,
        [issue.delivery_note_item_id]
      );
      const oi = oiRes.rows[0];

      await client.query(
        `INSERT INTO delivery_note_items (delivery_note_id, order_item_id, item_id, qty_shipped, price_at_shipment)
         VALUES ($1, $2, $3, $4, $5)`,
        [newDnId, oi.order_item_id, issue.item_id, issue.qty_issue, oi.price_at_shipment]
      );

      // We should probably revert order_item_id status back to DIKEMAS or something so it can be shipped, 
      // but since we already created a DRAFT DO, it will handle it.
      await client.query(
        `UPDATE order_items SET item_status = 'DIKEMAS' WHERE id = $1`,
        [oi.order_item_id]
      );
      await client.query(
        `UPDATE orders SET status = 'PROCESSING' WHERE id = $1`,
        [issue.order_id]
      );
      
      return { success: true, new_dn_id: newDnId };
    }

    return { success: true };
  });
}

export async function approveAndTransferDeliveryNote(deliveryNoteId: number, adminId: number) {
  return withTransaction(async (client) => {
    // 1. Dapatkan informasi Delivery Note
    const dnRes = await client.query(
      `SELECT id, order_id, outlet_id, status FROM delivery_notes WHERE id = $1 FOR UPDATE`,
      [deliveryNoteId]
    );
    const dn = dnRes.rows[0];
    if (!dn) throw new Error('Surat Jalan tidak ditemukan');
    if (dn.status === 'DITERIMA' || dn.status === 'CANCELLED') {
      throw new Error(`Surat Jalan dengan status ${dn.status} tidak dapat diproses transfer stok.`);
    }

    // 2. Ambil semua item dalam Delivery Note
    const itemsRes = await client.query(
      `SELECT id, item_id, qty_shipped, qty_received, order_item_id, price_at_shipment 
       FROM delivery_note_items 
       WHERE delivery_note_id = $1`,
      [deliveryNoteId]
    );

    if (itemsRes.rows.length === 0) {
      throw new Error('Surat Jalan tidak memiliki item untuk ditransfer.');
    }

    for (const dni of itemsRes.rows) {
      const qty = parseFloat(dni.qty_received ?? dni.qty_shipped ?? '0');
      if (qty <= 0) continue;

      // STEP 1: Potong stok dari Gudang Pusat (inventory_logs)
      const balRes = await client.query(
        `SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [dni.item_id]
      );
      const centralOldBalance = parseFloat(balRes.rows[0]?.ending_balance ?? '0');
      const centralNewBalance = centralOldBalance - qty;

      await client.query(
        `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         VALUES ($1, 'OUT', $2, $3, 'ATOMIC_TRANSFER', $4)`,
        [dni.item_id, -qty, centralNewBalance, deliveryNoteId]
      );

      // STEP 2: Tambahkan stok ke Gudang Outlet (outlet_stocks & outlet_inventory_logs)
      const stockRes = await client.query(
        `SELECT current_balance FROM outlet_stocks WHERE outlet_id = $1 AND item_id = $2 FOR UPDATE`,
        [dn.outlet_id, dni.item_id]
      );

      let outletOldBalance = 0;
      if (stockRes.rows.length > 0) {
        outletOldBalance = parseFloat(stockRes.rows[0].current_balance);
        const outletNewBalance = outletOldBalance + qty;
        await client.query(
          `UPDATE outlet_stocks SET current_balance = $1, updated_at = NOW() WHERE outlet_id = $2 AND item_id = $3`,
          [outletNewBalance, dn.outlet_id, dni.item_id]
        );
      } else {
        await client.query(
          `INSERT INTO outlet_stocks (outlet_id, item_id, current_balance, updated_at) VALUES ($1, $2, $3, NOW())`,
          [dn.outlet_id, dni.item_id, qty]
        );
      }

      const outletLogBalance = outletOldBalance + qty;
      await client.query(
        `INSERT INTO outlet_inventory_logs (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         VALUES ($1, $2, 'IN', $3, $4, 'ATOMIC_TRANSFER', $5)`,
        [dn.outlet_id, dni.item_id, qty, outletLogBalance, deliveryNoteId]
      );

      // STEP 3: Update delivery_note_items menjadi sudah scan IN dan OUT
      await client.query(
        `UPDATE delivery_note_items 
         SET scanned_out_at = COALESCE(scanned_out_at, NOW()),
             scanned_out_by = COALESCE(scanned_out_by, $1),
             scanned_in_at = COALESCE(scanned_in_at, NOW()),
             scanned_in_by = COALESCE(scanned_in_by, $1),
             qty_received = $2
         WHERE id = $3`,
        [adminId, qty, dni.id]
      );

      // STEP 4: Update order item menjadi SELESAI
      if (dni.order_item_id) {
        await client.query(
          `UPDATE order_items SET item_status = 'SELESAI', distribution_price = $1, updated_at = NOW() WHERE id = $2`,
          [dni.price_at_shipment, dni.order_item_id]
        );
      }
    }

    // 3. Update status Delivery Note menjadi DITERIMA
    await client.query(
      `UPDATE delivery_notes SET status = 'DITERIMA', updated_at = NOW() WHERE id = $1`,
      [deliveryNoteId]
    );

    // 4. Update status Order menjadi COMPLETED
    if (dn.order_id) {
      await client.query(
        `UPDATE orders SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
        [dn.order_id]
      );
    }

    return { success: true };
  });
}

