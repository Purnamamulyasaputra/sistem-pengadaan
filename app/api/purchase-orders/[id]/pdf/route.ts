import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPurchaseOrderById } from '@/lib/queries/purchase-orders';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmtCurrency = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const po = await getPurchaseOrderById(Number(id));
  if (!po) return new NextResponse('Not found', { status: 404 });

  const doc = new jsPDF();
  const poNum = po.po_number || 'DRAFT';

  // Header
  doc.setFontSize(20);
  doc.text('PURCHASE ORDER', 14, 22);
  doc.setFontSize(10);
  doc.text(`PO Number: ${poNum}`, 14, 30);
  doc.text(`Order Date: ${new Date(po.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 35);
  doc.text(`Vendor: ${po.vendor_name || ''}`, 14, 40);
  doc.text(`Deliver To: ${po.destination_outlet_name || ''}`, 14, 45);

  let computedSubtotal = 0;
  let computedTax = 0;

  // Table
  const tableData = (po.items || []).map((l: any, i: number) => {
    if (l.line_type === 'CATATAN') {
      return [
        i + 1,
        { content: l.description, styles: { fontStyle: 'italic', textColor: '#64748b' } },
        '',
        '',
        '',
        ''
      ];
    }

    const q = Number(l.qty) || 0;
    const up = Number(l.unit_price) || 0;
    const t = Number(l.tax_percent) || 0;
    const d = Number(l.discount_percent) || 0;
    const net = (q * up) * (1 - d / 100);
    computedSubtotal += net;
    computedTax += net * (t / 100);

    return [
      i + 1,
      l.description || l.item_name || '',
      l.qty,
      l.purchase_unit || '-',
      fmtCurrency(up).replace(',00', ''),
      fmtCurrency(net).replace(',00', '')
    ];
  });

  autoTable(doc, {
    startY: 55,
    head: [['#', 'Description', 'Qty', 'Unit', 'Unit Price', 'Amount']],
    body: tableData as any,
  });

  const computedTotal = computedSubtotal + computedTax;

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY || 55;
  doc.text(`Subtotal: ${fmtCurrency(computedSubtotal).replace(',00', '')}`, 140, finalY + 10);
  doc.text(`Taxes: ${fmtCurrency(computedTax).replace(',00', '')}`, 140, finalY + 16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${fmtCurrency(computedTotal).replace(',00', '')}`, 140, finalY + 24);

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${poNum.replace(/\//g, '_')}.pdf"`,
    },
  });
}
