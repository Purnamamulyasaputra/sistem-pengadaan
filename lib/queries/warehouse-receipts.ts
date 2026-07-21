import { query, withTransaction } from '@/lib/db';
import { autoFulfillPendingRequests } from './orders';

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
  items: { purchase_order_item_id: number; item_id: number; qty_received: number }[];
}) {
  return withTransaction(async (client) => {
    const receiptNumber = await generateReceiptNumber();
    
    const receiptRes = await client.query(
      `INSERT INTO goods_receipts (purchase_order_id, receipt_number, vendor_delivery_note, received_by, status)
       VALUES ($1, $2, $3, $4, 'DONE') RETURNING *`,
      [data.purchase_order_id, receiptNumber, data.vendor_delivery_note || null, data.received_by]
    );
    const receipt = receiptRes.rows[0];

    // Fetch PO vendor
    const poRes = await client.query(`SELECT vendor_id FROM purchase_orders WHERE id = $1`, [data.purchase_order_id]);
    const vendorId = poRes.rows[0]?.vendor_id;

    // Insert items and update inventory & price history
    for (const item of data.items) {
      await client.query(
        `INSERT INTO goods_receipt_items (goods_receipt_id, purchase_order_item_id, item_id, qty_received)
         VALUES ($1, $2, $3, $4)`,
        [receipt.id, item.purchase_order_item_id, item.item_id, item.qty_received]
      );
      
      // Get unit_price and conversion_ratio from PO item
      const poiRes = await client.query(`SELECT unit_price, conversion_ratio FROM purchase_order_items WHERE id = $1`, [item.purchase_order_item_id]);
      const unit_price = poiRes.rows.length > 0 ? parseFloat(poiRes.rows[0].unit_price) : 0;
      const poRatio = poiRes.rows.length > 0 && poiRes.rows[0].conversion_ratio ? parseFloat(poiRes.rows[0].conversion_ratio) : null;

      // Fetch current average price (and fallback ratio) from items
      const itemRes = await client.query(`SELECT conversion_ratio, current_average_price FROM items WHERE id = $1 FOR UPDATE`, [item.item_id]);
      const fallbackRatio = itemRes.rows.length > 0 ? parseFloat(itemRes.rows[0].conversion_ratio || 1) : 1;
      const ratio = poRatio !== null ? poRatio : fallbackRatio;
      const oldAvg = itemRes.rows.length > 0 ? parseFloat(itemRes.rows[0].current_average_price || 0) : 0;
      
      const qtyInSmallestUnit = item.qty_received * ratio;
      const unitPriceInSmallestUnit = unit_price / ratio; // Price per smallest unit

      // Get current stock
      const stockRes = await client.query(`SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1`, [item.item_id]);
      const currentStock = stockRes.rows.length > 0 ? parseFloat(stockRes.rows[0].ending_balance) : 0;
      const newStock = currentStock + qtyInSmallestUnit;
      
      // Calculate new Moving Average
      const oldValue = oldAvg * currentStock;
      const newValue = unitPriceInSmallestUnit * qtyInSmallestUnit;
      const newAvgPrice = newStock > 0 ? (oldValue + newValue) / newStock : 0;

      // Update price cache in items
      await client.query(
        `UPDATE items SET current_average_price = $1, updated_at = now() WHERE id = $2`,
        [newAvgPrice, item.item_id]
      );
      
      // Insert inventory log
      await client.query(
        `INSERT INTO inventory_logs (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
         VALUES ($1, 'IN', $2, $3, 'RECEIPT', $4)`,
        [item.item_id, qtyInSmallestUnit, newStock, receipt.id]
      );

      // Auto-fulfill pending requests for this item since stock arrived
      await autoFulfillPendingRequests(client, item.item_id, newStock);

      // Insert price history
      await client.query(
        `INSERT INTO price_history (item_id, vendor_id, purchase_date, purchase_qty, unit_purchase_price, new_average_price, purchase_order_item_id)
         VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)`,
        [item.item_id, vendorId, item.qty_received, unit_price, newAvgPrice, item.purchase_order_item_id]
      );
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
