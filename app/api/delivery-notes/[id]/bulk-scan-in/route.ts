import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withTransaction } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const delivery_note_id = Number(id);
  const body = await req.json();
  const items: Array<{
    delivery_note_item_id: number;
    qty_received: number;
    discrepancy_reason?: string;
    discrepancy_notes?: string;
  }> = body.items;

  if (!items || !Array.isArray(items)) {
    return NextResponse.json({ success: false, message: 'Invalid data' }, { status: 400 });
  }

  try {
    await withTransaction(async (client) => {
      const dniIds = items.map(i => i.delivery_note_item_id);
      const qtys = items.map(i => i.qty_received);
      const reasons = items.map(i => i.discrepancy_reason || null);
      const notes = items.map(i => i.discrepancy_notes || null);

      await client.query(
        `UPDATE delivery_note_items 
         SET scanned_in_at = now(), scanned_in_by = $1, 
             qty_received = u.qty, discrepancy_reason = u.reason, discrepancy_notes = u.notes 
         FROM UNNEST($2::int[], $3::numeric[], $4::text[], $5::text[]) AS u(id, qty, reason, notes)
         WHERE delivery_note_items.id = u.id AND delivery_note_items.delivery_note_id = $6`,
        [session.userId, dniIds, qtys, reasons, notes, delivery_note_id]
      );

      const issue_dniIds: number[] = [];
      const issue_qtys: number[] = [];
      const issue_reasons: string[] = [];

      // Only check issues for items that have discrepancy_reason
      const issuesToCheck = items.filter(i => i.discrepancy_reason);
      if (issuesToCheck.length > 0) {
        const issueDniIds = issuesToCheck.map(i => i.delivery_note_item_id);
        const dniRes = await client.query(
          `SELECT id, qty_shipped FROM delivery_note_items WHERE id = ANY($1::int[])`,
          [issueDniIds]
        );
        const shippedMap = new Map();
        for (const row of dniRes.rows) {
          shippedMap.set(Number(row.id), parseFloat(row.qty_shipped));
        }

        for (const item of issuesToCheck) {
          const shipped = shippedMap.get(item.delivery_note_item_id) || 0;
          const issueQty = shipped - item.qty_received;
          if (issueQty > 0) {
            issue_dniIds.push(item.delivery_note_item_id);
            issue_qtys.push(issueQty);
            const fullReason = item.discrepancy_reason === 'Lainnya' ? (item.discrepancy_notes || 'Lainnya') : (item.discrepancy_reason || 'Unknown');
            issue_reasons.push(fullReason);
          }
        }
      }

      if (issue_dniIds.length > 0) {
        await client.query(
          `INSERT INTO delivery_note_issues (delivery_note_item_id, qty_issue, reason, photo_url, status) 
           SELECT u.id, u.qty, u.reason, '', 'PENDING'
           FROM UNNEST($1::int[], $2::numeric[], $3::text[]) AS u(id, qty, reason)`,
          [issue_dniIds, issue_qtys, issue_reasons]
        );
      }
    });

    return NextResponse.json({ success: true, message: 'Scan IN recorded successfully' });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') }, { status: 400 });
  }
}
