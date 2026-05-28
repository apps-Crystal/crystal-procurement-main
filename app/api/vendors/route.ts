import { NextRequest, NextResponse } from 'next/server';
import { readSheet, rowsToObjects, writeNewRow } from '@/lib/sheets';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase();
    const site = searchParams.get('site');
    const kyc = searchParams.get('kyc');

    const rows = await readSheet('Vendor_Master');
    let vendors = rowsToObjects(rows);

    if (site && site !== 'all') {
      vendors = vendors.filter(v => v.Providing_Sites?.includes(site));
    }

    if (search) {
      vendors = vendors.filter(v =>
        v.Company_Name?.toLowerCase().includes(search) ||
        v.Vendor_ID?.toLowerCase().includes(search) ||
        v.GST_Number?.toLowerCase().includes(search) ||
        v.Vendor_PAN?.toLowerCase().includes(search)
      );
    }

    // KYC completeness
    vendors = vendors.map(v => {
      const docs = [v.GST_Certificate_Link, v.PanCard_Link, v.Cancelled_Cheque_Link, v.MSME_Certificate_Link];
      const filled = docs.filter(d => d && d.trim()).length;
      const kyc_status = filled === 4 ? 'complete' : filled === 0 ? 'none' : 'partial';
      const kyc_label = filled === 4 ? 'Complete' : `${filled}/4 docs`;
      return { ...v, kyc_status, kyc_label, kyc_filled: String(filled) };
    });

    if (kyc === 'complete') vendors = vendors.filter(v => v.kyc_status === 'complete');
    if (kyc === 'incomplete') vendors = vendors.filter(v => v.kyc_status !== 'complete');

    return NextResponse.json({ vendors });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company_name, contact_person, contact_number, email, gst_number,
      pan, msme_number, bank_name, acc_holder, acc_number, branch, ifsc,
      address, providing_sites, created_by } = body;

    // Generate Vendor ID
    const rows = await readSheet('Vendor_Master');
    const vendors = rowsToObjects(rows);
    const lastId = vendors.reduce((max, v) => {
      const num = parseInt(v.Vendor_ID?.replace('V-', '') || '0');
      return num > max ? num : max;
    }, 0);
    const vendor_id = `V-${String(lastId + 1).padStart(4, '0')}`;
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Check PAN duplicate
    const dupPAN = vendors.find(v => v.Vendor_PAN === pan && pan);
    if (dupPAN) return NextResponse.json({ error: `PAN already registered under ${dupPAN.Company_Name} (${dupPAN.Vendor_ID})` }, { status: 400 });

    await writeNewRow('Vendor_Master', [
      vendor_id, company_name, contact_person, contact_number, email,
      bank_name, acc_holder, acc_number, branch, ifsc,
      gst_number, Array.isArray(providing_sites) ? providing_sites.join(', ') : providing_sites,
      pan, msme_number, address, '', '', '', '', 'Yes', now, created_by,
    ]);

    return NextResponse.json({ vendor_id, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
