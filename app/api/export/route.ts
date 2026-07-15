import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  }

  const format = req.nextUrl.searchParams.get('format');

  try {
    // 1. Fetch all master data
    const [itemsRes, ingredientsRes, outletsRes, vendorsRes] = await Promise.all([
      query('SELECT * FROM items ORDER BY id ASC'),
      query('SELECT * FROM ingredients ORDER BY id ASC'),
      query('SELECT * FROM outlets ORDER BY id ASC'),
      query('SELECT * FROM vendors ORDER BY id ASC')
    ]);

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: {
          items: itemsRes.rows,
          ingredients: ingredientsRes.rows,
          outlets: outletsRes.rows,
          vendors: vendorsRes.rows
        }
      });
    }

    // 2. Create workbook
    const wb = XLSX.utils.book_new();

    // 3. Create worksheets
    const wsItems = XLSX.utils.json_to_sheet(itemsRes.rows);
    const wsIngredients = XLSX.utils.json_to_sheet(ingredientsRes.rows);
    const wsOutlets = XLSX.utils.json_to_sheet(outletsRes.rows);
    const wsVendors = XLSX.utils.json_to_sheet(vendorsRes.rows);

    // 4. Append worksheets to workbook
    XLSX.utils.book_append_sheet(wb, wsItems, 'Data Item');
    XLSX.utils.book_append_sheet(wb, wsIngredients, 'Data Bahan (HPP)');
    XLSX.utils.book_append_sheet(wb, wsOutlets, 'Data Outlet');
    XLSX.utils.book_append_sheet(wb, wsVendors, 'Data Vendor');

    // 5. Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 6. Send as response
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Sunrise_Daily_Master_Data_${new Date().toISOString().slice(0,10)}.xlsx"`
      }
    });

  } catch (err) {
    console.error('Export DB error:', err);
    return NextResponse.json({ success: false, message: 'Gagal mengekspor data' }, { status: 500 });
  }
}
