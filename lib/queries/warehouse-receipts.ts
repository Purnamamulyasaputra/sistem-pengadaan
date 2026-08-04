import { query, withTransaction } from '@/lib/db';
import { autoFulfillPendingRequests } from './orders';
import { checkAndCreateAlert } from './alerts';

export interface GoodsReceipt {
  id: number;
  purchase_order_id: number;
  receipt_number: string;
  vendor_delivery_note?: string;
  received_date: string;
  received_by?: number;
  status: string;
  created_at: string;
}

export interface GoodsReceiptItem {
  id: number;
  goods_receipt_id: number;
  purchase_order_item_id: number;
  item_id: number;
  qty_received: number;
}

export async function generateReceiptNumber() {
  let isUnique = false;
  let receiptNumber = '';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  while (!isUnique) {
    const random4 = Math.floor(1000 + Math.random() * 9000);
    receiptNumber = `WH/IN/${year}/${month}/${random4}`;
    
    const res = await query(`SELECT id FROM goods_receipts WHERE receipt_number = $1`, [receiptNumber]);
    if (res.rows.length === 0) {
      isUnique = true;
    }
  }
  
  return receiptNumber;
}

export async function createGoodsReceipt(data: {
  purchase_order_id: number;
  vendor_delivery_note?: string;
  received_by: number;
  received_date?: string;
  items: {
    purchase_order_item_id: number;
    item_id: number;
    qty_received: number;
  }[];
}) {
  return withTransaction(async (client) => {
    const receiptNumber = await generateReceiptNumber();
    
    const receiptRes = await client.query(
      `INSERT INTO goods_receipts (purchase_order_id, receipt_number, vendor_delivery_note, received_by, received_date, status)
       VALUES ($1, $2, $3, $4, COALESCE($5, now()), 'DONE') RETURNING *`,
      [data.purchase_order_id, receiptNumber, data.vendor_delivery_note || null, data.received_by, data.received_date || null]
    );
    const receipt = receiptRes.rows[0];

    // Fetch PO vendor
    const poRes = await client.query(`SELECT vendor_id FROM purchase_orders WHERE id = $1`, [data.purchase_order_id]);
    const vendorId = poRes.rows[0]?.vendor_id;

    if (data.items.length > 0) {
      const poItemIds = data.items.map(i => Number(i.purchase_order_item_id));
      const itemIds = data.items.map(i => Number(i.item_id));

      const poiRes = await client.query(
        `SELECT id, unit_price, conversion_ratio FROM purchase_order_items WHERE id = ANY($1::int[])`,
        [poItemIds]
      );
      const poiMap = new Map<number, typeof poiRes.rows[0]>();
      for (const row of poiRes.rows) poiMap.set(Number(row.id), row);

      const itemRes = await client.query(
        `SELECT id, conversion_ratio, current_average_price FROM items WHERE id = ANY($1::int[]) FOR UPDATE`,
        [itemIds]
      );
      const itemMap = new Map<number, typeof itemRes.rows[0]>();
      for (const row of itemRes.rows) itemMap.set(Number(row.id), row);

      const stockRes = await client.query(
        `SELECT DISTINCT ON (item_id) item_id, ending_balance 
         FROM inventory_logs 
         WHERE item_id = ANY($1::int[]) 
         ORDER BY item_id, created_at DESC`,
        [itemIds]
      );
      const stockMap = new Map<number, typeof stockRes.rows[0]>();
      for (const row of stockRes.rows) stockMap.set(Number(row.item_id), row);

      const gri_receiptIds: number[] = [];
      const gri_poItemIds: number[] = [];
      const gri_itemIds: number[] = [];
      const gri_qtyReceived: number[] = [];

      const upd_itemIds: number[] = [];
      const upd_newAvgPrices: number[] = [];
      const upd_unitPrices: number[] = [];

      const inv_itemIds: number[] = [];
      const inv_qtyChanges: number[] = [];
      const inv_newStocks: number[] = [];
      const inv_receiptIds: number[] = [];

      const ph_itemIds: number[] = [];
      const ph_vendorIds: (number | null)[] = [];
      const ph_qtyReceived: number[] = [];
      const ph_unitPrices: number[] = [];
      const ph_newAvgPrices: number[] = [];
      const ph_poItemIds: number[] = [];

      const triggerActions: { itemId: number, newStock: number }[] = [];

      for (const item of data.items) {
        // Gunakan Number() konsisten agar tidak mismatch tipe string/number di Map lookup
        const poiData = poiMap.get(Number(item.purchase_order_item_id));
        const unit_price = poiData ? parseFloat(String(poiData.unit_price || '0')) : 0;

        // Ambil rasio dari PO item (snapshot satuan saat PO dibuat).
        // Jika null (PO lama), fallback ke master barang saat ini.
        const itemData = itemMap.get(Number(item.item_id));
        const masterRatio = itemData ? parseFloat(String(itemData.conversion_ratio || '1')) : 1;
        const poRatioRaw = poiData?.conversion_ratio;
        const ratio = (poRatioRaw !== null && poRatioRaw !== undefined && parseFloat(String(poRatioRaw)) > 0)
          ? parseFloat(String(poRatioRaw))
          : masterRatio;
        const oldAvg = itemData ? parseFloat(String(itemData.current_average_price || '0')) : 0;

        const qtyInSmallestUnit = Number(item.qty_received) * ratio;
        const unitPriceInSmallestUnit = unit_price / ratio;

        const stockData = stockMap.get(Number(item.item_id));
        const currentStock = stockData ? parseFloat(stockData.ending_balance || '0') : 0;
        const newStock = currentStock + qtyInSmallestUnit;

        const effectiveOldStock = currentStock > 0 ? currentStock : 0;
        const effectiveNewStock = effectiveOldStock + qtyInSmallestUnit;
        const oldValue = oldAvg * effectiveOldStock;
        const newValue = unitPriceInSmallestUnit * qtyInSmallestUnit;
        const newAvgPrice = effectiveNewStock > 0 ? (oldValue + newValue) / effectiveNewStock : unitPriceInSmallestUnit;

        gri_receiptIds.push(Number(receipt.id));
        gri_poItemIds.push(Number(item.purchase_order_item_id));
        gri_itemIds.push(Number(item.item_id));
        gri_qtyReceived.push(Number(item.qty_received));

        upd_itemIds.push(Number(item.item_id));
        upd_newAvgPrices.push(newAvgPrice);
        upd_unitPrices.push(unitPriceInSmallestUnit);

        inv_itemIds.push(Number(item.item_id));
        inv_qtyChanges.push(qtyInSmallestUnit);
        inv_newStocks.push(newStock);
        inv_receiptIds.push(Number(receipt.id));

        ph_itemIds.push(Number(item.item_id));
        ph_vendorIds.push(vendorId ? Number(vendorId) : null);
        ph_qtyReceived.push(Number(item.qty_received));
        ph_unitPrices.push(unit_price);
        ph_newAvgPrices.push(newAvgPrice);
        ph_poItemIds.push(Number(item.purchase_order_item_id));

        triggerActions.push({ itemId: item.item_id, newStock });
      }

      await client.query(
        `INSERT INTO goods_receipt_items (goods_receipt_id, purchase_order_item_id, item_id, qty_received)
         SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[], $4::numeric[])`,
        [gri_receiptIds, gri_poItemIds, gri_itemIds, gri_qtyReceived]
      );

      await client.query(
        `UPDATE items 
         SET current_average_price = u.new_avg, 
             last_purchase_price = u.unit_price, 
             updated_at = now() 
         FROM UNNEST($1::int[], $2::numeric[], $3::numeric[]) AS u(id, new_avg, unit_price)
         WHERE items.id = u.id`,
        [upd_itemIds, upd_newAvgPrices, upd_unitPrices]
      );

      await client.query(
        `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         SELECT u.item_id, 'IN', u.qty_change, u.new_stock, 'RECEIPT', u.receipt_id
         FROM UNNEST($1::int[], $2::numeric[], $3::numeric[], $4::int[]) AS u(item_id, qty_change, new_stock, receipt_id)`,
        [inv_itemIds, inv_qtyChanges, inv_newStocks, inv_receiptIds]
      );

      await client.query(
        `INSERT INTO price_history (item_id, vendor_id, purchase_date, purchase_qty, unit_purchase_price, new_average_price, purchase_order_item_id)
         SELECT u.item_id, u.vendor_id, CURRENT_DATE, u.qty_recv, u.unit_price, u.new_avg, u.po_item_id
         FROM UNNEST($1::int[], $2::int[], $3::numeric[], $4::numeric[], $5::numeric[], $6::int[]) AS u(item_id, vendor_id, qty_recv, unit_price, new_avg, po_item_id)`,
        [ph_itemIds, ph_vendorIds, ph_qtyReceived, ph_unitPrices, ph_newAvgPrices, ph_poItemIds]
      );

      for (const t of triggerActions) {
        await autoFulfillPendingRequests(client, t.itemId, t.newStock);
        await checkAndCreateAlert(t.itemId, t.newStock, client);
      }
    }
    
    // Check if PO is fully received
    const poItemsRes = await client.query(
      `SELECT poi.id, poi.qty, COALESCE(SUM(gri.qty_received), 0) as total_received
       FROM purchase_order_items poi
       LEFT JOIN goods_receipt_items gri ON gri.purchase_order_item_id = poi.id
       WHERE poi.purchase_order_id = $1 AND poi.item_id IS NOT NULL
       GROUP BY poi.id, poi.qty`,
      [data.purchase_order_id]
    );
    
    let isFullyReceived = true;
    for (const row of poItemsRes.rows) {
      if (parseFloat(row.total_received) < parseFloat(row.qty)) {
        isFullyReceived = false;
        break;
      }
    }
    
    const newStatus = isFullyReceived ? 'SELESAI' : 'DITERIMA_SEBAGIAN';
    await client.query(`UPDATE purchase_orders SET status = $1, updated_at = now() WHERE id = $2`, [newStatus, data.purchase_order_id]);
    
    return receipt;
  });
}
