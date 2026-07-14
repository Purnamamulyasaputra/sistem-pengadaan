import { query } from '@/lib/db';
import type { PoolClient } from 'pg';

export async function checkAndCreateAlert(
  itemId: number,
  currentBalance: number,
  client?: PoolClient
) {
  const doQuery = client ? client.query.bind(client) : query;

  // Get item threshold settings
  const itemRes = await doQuery(
    `SELECT minimum_threshold, threshold_type, computed_threshold_cache FROM items WHERE id = $1`,
    [itemId]
  );
  const item = itemRes.rows[0];
  if (!item) return;

  let threshold = parseFloat(item.minimum_threshold ?? '0');

  if (item.threshold_type === 'PERSENTASE') {
    if (item.computed_threshold_cache) {
      threshold = parseFloat(item.computed_threshold_cache);
    } else {
      // Calculate from last 3 months avg distribution
      const avgRes = await doQuery(
        `SELECT COALESCE(SUM(ABS(qty_change)) / 3.0, 0) AS avg_monthly
         FROM inventory_logs
         WHERE item_id = $1 AND movement_type = 'OUT' AND reference_type = 'ORDER'
           AND created_at >= now() - INTERVAL '3 months'`,
        [itemId]
      );
      const avgMonthly = parseFloat(avgRes.rows[0]?.avg_monthly ?? '0');
      threshold = (parseFloat(item.minimum_threshold) / 100) * avgMonthly;
    }
  }

  if (currentBalance > threshold) return;

  // Check if alert already open
  const existingRes = await doQuery(
    `SELECT id FROM stock_alerts WHERE item_id = $1 AND is_resolved = FALSE LIMIT 1`,
    [itemId]
  );
  if (existingRes.rows.length > 0) return;

  // Create alert
  await doQuery(
    `INSERT INTO stock_alerts (item_id, balance_at_alert, threshold_at_alert) VALUES ($1, $2, $3)`,
    [itemId, currentBalance, threshold]
  );
}

export async function getAlerts(opts?: { resolved?: boolean }) {
  const where = opts?.resolved !== undefined ? `WHERE sa.is_resolved = $1` : `WHERE sa.is_resolved = FALSE`;
  const params = opts?.resolved !== undefined ? [opts.resolved] : [];

  const result = await query(
    `SELECT sa.*, i.name AS item_name, i.smallest_unit, i.minimum_threshold, i.threshold_type,
            i.current_average_price,
            (SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1) AS current_balance
     FROM stock_alerts sa
     LEFT JOIN items i ON i.id = sa.item_id
     ${where}
     ORDER BY sa.created_at DESC`,
    params
  );
  return result.rows;
}

export async function resolveAlert(alertId: number, referencePoId?: number) {
  const result = await query(
    `UPDATE stock_alerts SET is_resolved = TRUE, reference_po_id = $2 WHERE id = $1 RETURNING *`,
    [alertId, referencePoId ?? null]
  );
  return result.rows[0] ?? null;
}

export async function getUnresolvedAlertCount(): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int AS cnt FROM stock_alerts WHERE is_resolved = FALSE`
  );
  return result.rows[0]?.cnt ?? 0;
}
