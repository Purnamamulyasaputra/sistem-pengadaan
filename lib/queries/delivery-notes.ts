import { query, withTransaction } from '@/lib/db';
import { outboundStock } from './inventory';

export interface DeliveryNote {
  id: number;
  delivery_note_number: string;
  order_id: number;
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
  items: Array<{ order_item_id: number; item_id: number; qty_shipped: number; price_at_shipment: number; keterangan?: string }>;
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
      const uniqueBarcode = Date.now().toString().slice(-6) + Math.floor(1000 + Math.random() * 9000).toString();
      await client.query(
        `INSERT INTO delivery_note_items (delivery_note_id, order_item_id, item_id, qty_shipped, price_at_shipment, keterangan, unique_barcode)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [dn.id, item.order_item_id, item.item_id, item.qty_shipped, item.price_at_shipment, item.keterangan || null, uniqueBarcode]
      );
    }

    return dn;
  });
}

export async function getDeliveryNotes(opts?: { outletId?: number; status?: string; orderId?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts?.outletId) { conditions.push(`dn.outlet_id = $${i++}`); params.push(opts.outletId); }
  if (opts?.status) { conditions.push(`dn.status = $${i++}`); params.push(opts.status); }
  if (opts?.orderId) { conditions.push(`dn.order_id = $${i++}`); params.push(opts.orderId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<DeliveryNote>(
    `SELECT dn.*, o.name AS outlet_name
     FROM delivery_notes dn
     LEFT JOIN outlets o ON o.id = dn.outlet_id
     ${where}
     ORDER BY dn.created_at DESC`,
    params
  );
  return result.rows;
}

export async function getShippedDeliveryNoteCount(outletId: number) {
  const result = await query<{ count: string }>(
    `SELECT count(*) FROM delivery_notes WHERE outlet_id = $1 AND status = 'DIKIRIM'`,
    [outletId]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function getDeliveryNoteById(id: number) {
  const dnRes = await query<DeliveryNote>(
    `SELECT dn.*, o.name AS outlet_name
     FROM delivery_notes dn
     LEFT JOIN outlets o ON o.id = dn.outlet_id
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

      // Deduct stock from central warehouse
      const balRes = await client.query(
        `SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [data.item_id]
      );
      const oldBalance = parseFloat(balRes.rows[0]?.ending_balance ?? '0');
      const newBalance = oldBalance - dni.qty_shipped;

      await client.query(
        `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         VALUES ($1,'OUT',$2,$3,'BARCODE_SCAN',$4)`,
        [data.item_id, -dni.qty_shipped, newBalance, data.delivery_note_item_id]
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
        // deduct stock
        const balRes = await client.query(`SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1`, [dni.item_id]);
        const oldBalance = parseFloat(balRes.rows[0]?.ending_balance ?? '0');
        await client.query(
          `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id) VALUES ($1,'OUT',$2,$3,'BARCODE_SCAN',$4)`,
          [dni.item_id, -dni.qty_shipped, oldBalance - dni.qty_shipped, dni.id]
        );
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
