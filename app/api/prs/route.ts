import { NextRequest, NextResponse } from 'next/server';
import { readSheet, rowsToObjects, appendRow, getNextId } from '@/lib/sheets';
import { getCurrentUser } from '@/lib/current-user';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const site = searchParams.get('site');
    const status = searchParams.get('status');

    const rows = await readSheet('PR_Master');
    let prs = rowsToObjects(rows);

    if (site && site !== 'all') prs = prs.filter(p => p.Site === site);
    if (status && status !== 'all') prs = prs.filter(p => p.Status_Code === status);

    // Add aging in days
    const now = Date.now();
    prs = prs.map(pr => {
      const raw = pr.Timestamp || pr.Date_of_Requisition || '';
      const d = raw.split(' ')[0];
      const parts = d.split('/');
      const iso = parts.length === 3 && parts[2].length === 4
        ? `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}` : d;
      const ts = iso ? new Date(iso).getTime() : 0;
      const agingDays = ts ? Math.floor((now - ts) / 86400000) : 0;
      return { ...pr, aging_days: String(agingDays) };
    });

    // Sort newest first
    prs.reverse();

    return NextResponse.json({ prs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { site, purpose, vendor_id, category, payment_stages, delivery_terms,
      delivery_location, expected_delivery, procurement_type, is_reimbursable,
      requisitioned_by, warranty_amc, freight_amount, installation_amount,
      items } = body;

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const raised_by = currentUser.name?.trim() || currentUser.email;

    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' }) + now.getFullYear();
    const counter = await getNextId('PR', site, month);
    const pr_id = `PR-${site}-${month}/${counter}`;
    const timestamp = now.toLocaleString('en-IN');

    // Build payment summary string from stages
    const paymentSummary = Object.entries(payment_stages || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}%`)
      .join(', ');

    const totalIncGST = items?.reduce((sum: number, item: any) => {
      const rate = parseFloat(item.rate) || 0;
      const qty = parseFloat(item.qty) || 0;
      const gst = parseFloat(item.gst) || 0;
      return sum + (qty * rate * (1 + gst / 100));
    }, 0) || 0;

    const prRow = [
      pr_id, timestamp, timestamp.split(',')[0], site, purpose,
      raised_by, vendor_id, category, 'MIXED', paymentSummary,
      delivery_terms, delivery_location, 'Yes', is_reimbursable || 'No',
      totalIncGST.toFixed(2), '', '', '', 'PR_SUBMITTED', 'PR Submitted',
      raised_by, timestamp, '', expected_delivery, warranty_amc || '',
      requisitioned_by, '', '', procurement_type || 'Opex',
      freight_amount ? 'Yes' : 'No', freight_amount || 0,
      installation_amount ? 'Yes' : 'No', installation_amount || 0,
    ];

    await appendRow('PR_Master', prRow);

    // Append items
    for (let i = 0; i < (items || []).length; i++) {
      const item = items[i];
      const rate = parseFloat(item.rate) || 0;
      const qty = parseFloat(item.qty) || 0;
      const gst = parseFloat(item.gst) || 0;
      const lineTotal = qty * rate * (1 + gst / 100);
      await appendRow('PR_Items', [
        pr_id, i + 1, item.name, item.purpose || '', qty,
        item.uom, rate, gst, item.warranty || '', lineTotal.toFixed(2),
      ]);
    }

    return NextResponse.json({ pr_id, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
