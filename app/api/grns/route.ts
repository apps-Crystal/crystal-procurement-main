import { NextRequest, NextResponse } from 'next/server';
import { readSheet, rowsToObjects, appendRow, getNextId } from '@/lib/sheets';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const site = searchParams.get('site');
    const status = searchParams.get('status');

    const [grnRows, vendorRows] = await Promise.all([
      readSheet('GRN_Master'),
      readSheet('Vendor_Master'),
    ]);

    let grns = rowsToObjects(grnRows);
    const vendors = rowsToObjects(vendorRows);

    if (site && site !== 'all') grns = grns.filter(g => g.Site === site);
    if (status && status !== 'all') grns = grns.filter(g => g.Status === status);

    // Enrich with vendor name and bill status
    grns = grns.map(grn => {
      const vendor = vendors.find(v => v.Vendor_ID === grn.Vendor_ID);
      const hasInvoice = !!(grn['Invoice_URL'] && grn['Invoice_URL'].trim());
      const createdTs = grn.Created_At ? new Date(grn.Created_At.split(' ')[0].split('/').reverse().join('-')).getTime() : 0;
      const billAgingDays = createdTs && !hasInvoice ? Math.floor((Date.now() - createdTs) / 86400000) : 0;
      return {
        ...grn,
        vendor_name: vendor?.Company_Name || grn.Vendor_ID,
        has_invoice: String(hasInvoice),
        bill_aging_days: String(billAgingDays),
      };
    });

    grns.reverse();
    return NextResponse.json({ grns });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { po_id, site, vendor_id, invoice_number, invoice_value, invoice_date,
      lr_number, vehicle_number, items, created_by_email, created_by_name } = body;

    const now = new Date();
    const month = now.toLocaleString('en-IN', { month: 'long', timeZone: 'Asia/Kolkata' })
      + now.toLocaleString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' });
    const counter = await getNextId('GRN', site, month);
    const grn_id = `GRN-${site}-${month}/${counter}`;
    const timestamp = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Duplicate invoice check
    const existingGRNs = await readSheet('GRN_Master');
    const existing = rowsToObjects(existingGRNs);
    const dup = existing.find(g => g['Invoice Number'] === invoice_number && g.Vendor_ID === vendor_id);
    if (dup) {
      return NextResponse.json({ error: `Duplicate invoice. Already recorded in ${dup.GRN_ID}` }, { status: 400 });
    }

    const grnRow = [
      grn_id, po_id, site, vendor_id, invoice_number, invoice_value,
      lr_number, invoice_date, '', timestamp, '', '', '', '',
      vehicle_number, timestamp, created_by_email, created_by_name,
      '', '', '', 'Draft', '', '', '', '', '', '', '',
    ];

    await appendRow('GRN_Master', grnRow);

    for (let i = 0; i < (items || []).length; i++) {
      const item = items[i];
      const balance = (parseFloat(item.ordered_qty) || 0) - (parseFloat(item.received_qty) || 0);
      await appendRow('GRN_Items', [
        grn_id, po_id, i + 1, '', item.item_name,
        item.ordered_qty, item.received_qty, item.invoice_qty || item.received_qty,
        item.defective_qty || 0, balance, item.uom, item.line_total || '',
        item.condition || 'Good', item.remarks || '', 'Pending',
        '', '', '', '', '', item.short_close || 'No', '',
      ]);
    }

    return NextResponse.json({ grn_id, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
