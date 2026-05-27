import { NextRequest, NextResponse } from 'next/server';
import { batchRead, readSheet, rowsToObjects, updateRow, findRowIndex } from '@/lib/sheets';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const vendorId = decodeURIComponent(id);

    const data = await batchRead(['Vendor_Master', 'PO_Master', 'GRN_Master']);

    const vendors = rowsToObjects(data['Vendor_Master']);
    const vendor = vendors.find(v => v.Vendor_ID === vendorId);
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    // KYC status
    const docs = [vendor.GST_Certificate_Link, vendor.PanCard_Link, vendor.Cancelled_Cheque_Link, vendor.MSME_Certificate_Link];
    const filled = docs.filter(d => d && d.trim()).length;
    const kyc_status = filled === 4 ? 'complete' : filled === 0 ? 'none' : 'partial';
    const kyc_label = filled === 4 ? 'KYC Complete' : `${filled}/4 docs`;

    // Recent POs (last 10)
    const allPos = rowsToObjects(data['PO_Master']);
    const recentPos = allPos
      .filter(p => p.Vendor_ID === vendorId)
      .reverse()
      .slice(0, 10);

    // Recent GRNs (last 10)
    const allGrns = rowsToObjects(data['GRN_Master']);
    const recentGrns = allGrns
      .filter(g => g.Vendor_ID === vendorId)
      .reverse()
      .slice(0, 10);

    // Stats
    const totalPOs = allPos.filter(p => p.Vendor_ID === vendorId).length;
    function parseNum(s: string | undefined): number {
      return parseFloat(String(s || '').replace(/[₹,\s]/g, '')) || 0;
    }
    const totalValue = allPos
      .filter(p => p.Vendor_ID === vendorId)
      .reduce((s, p) => s + parseNum(p.Total_Incl_GST), 0);

    return NextResponse.json({
      vendor: { ...vendor, kyc_status, kyc_label },
      recentPos,
      recentGrns,
      stats: { totalPOs, totalValue },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const vendorId = decodeURIComponent(id);
    const body = await req.json();

    const rows = await readSheet('Vendor_Master');
    const headers = rows[0];
    const rowIdx = findRowIndex(rows, headers.indexOf('Vendor_ID'), vendorId);
    if (rowIdx < 0) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    const row = [...rows[rowIdx - 1]];

    function setCol(col: string, val: string) {
      const i = headers.indexOf(col);
      if (i >= 0) row[i] = val;
    }

    // Update allowed fields
    const updatable = [
      'Company_Name', 'Contact_Person', 'Contact_Number', 'Email_ID',
      'Bank_Name', 'Account_Holder_Name', 'Account_Number', 'Branch_Name', 'IFSC_Code',
      'GST_Number', 'Vendor_PAN', 'MSME_No', 'Address', 'Providing_Sites',
      'GST_Certificate_Link', 'PanCard_Link', 'Cancelled_Cheque_Link', 'MSME_Certificate_Link',
    ];
    for (const field of updatable) {
      if (body[field] !== undefined) setCol(field, String(body[field]));
    }

    setCol('Last_Updated', new Date().toLocaleString('en-IN'));

    await updateRow(`Vendor_Master!A${rowIdx}`, row);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
