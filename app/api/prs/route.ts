import { NextRequest, NextResponse } from 'next/server';
import { readSheet, rowsToObjects, writeNewRow, getNextId } from '@/lib/sheets';
import { getCurrentUser } from '@/lib/current-user';
import { sendEventEmail, buildPrSubmittedEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const site = searchParams.get('site');
    const status = searchParams.get('status');
    const mine = searchParams.get('mine');

    const rows = await readSheet('PR_Master');
    let prs = rowsToObjects(rows);

    // Drop ghost rows (no PR_ID) left over from earlier broken submissions.
    prs = prs.filter(p => p.PR_ID && p.PR_ID.trim());

    if (site && site !== 'all') prs = prs.filter(p => p.Site === site);
    if (status && status !== 'all') prs = prs.filter(p => p.Status_Code === status);

    if (mine === '1' || mine === 'true') {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        const myName = (currentUser.name || '').trim();
        const myEmail = (currentUser.email || '').trim().toLowerCase();
        prs = prs.filter(p => {
          const raisedBy = (p.Requested_By || '').trim();
          return raisedBy === myName || raisedBy.toLowerCase() === myEmail;
        });
      } else {
        prs = [];
      }
    }

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
    const { site, purpose, vendor_id, category, payment_stages, specific_payment_terms,
      delivery_terms, delivery_location, delivery_charges, delivery_charge_amount,
      expected_delivery, procurement_type, is_reimbursable, requisitioned_by, warranty_amc,
      quality_terms, special_terms, other_terms, freight_amount,
      installation_amount, upload_quotation, final_agreed_pi, supporting_docs,
      vendor_order_ref_no, remarks, items } = body;

    if (!site) return NextResponse.json({ error: 'Site is required' }, { status: 400 });
    if (!category) return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const raised_by = currentUser.name?.trim() || currentUser.email;

    // Read existing headers BEFORE bumping the counter so a transient sheet
    // failure does not leave an orphan counter increment.
    const existingRows = await readSheet('PR_Master');
    const headers = existingRows.length > 0 ? existingRows[0] : [];

    const now = new Date();
    const month = now.toLocaleString('en-IN', { month: 'long', timeZone: 'Asia/Kolkata' })
      + now.toLocaleString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' });
    const counter = await getNextId('PR', site, month);
    const pr_id = `PR-${site}-${month}/${counter}`;
    const timestamp = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const paymentSummary = Object.entries(payment_stages || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}%`)
      .join(', ');

    const totalIncGST = items.reduce((sum: number, item: any) => {
      const rate = parseFloat(item.rate) || 0;
      const qty = parseFloat(item.qty) || 0;
      const gst = parseFloat(item.gst) || 0;
      return sum + (qty * rate * (1 + gst / 100));
    }, 0) + (delivery_charges === 'Chargeable' ? (parseFloat(delivery_charge_amount) || 0) : 0);

    const fieldMap: Record<string, any> = {
      PR_ID: pr_id,
      Timestamp: timestamp,
      Date_of_Requisition: timestamp.split(',')[0],
      Site: site,
      PR_Purpose: purpose || '',
      Requested_By: raised_by,
      Vendor_ID: vendor_id || '',
      Purchase_Category: category,
      Payment_Terms: specific_payment_terms || paymentSummary,
      Advance: payment_stages?.Advance || '',
      'Before Delivery': payment_stages?.['Before Delivery'] || '',
      Running: payment_stages?.Running || '',
      'Post Delivery': payment_stages?.['Post Delivery'] || '',
      'Post Completion': payment_stages?.['Post Completion'] || '',
      Retention: payment_stages?.Retention || '',
      Delivery_Terms: delivery_terms || '',
      'Delivery Terms': delivery_terms || '',
      Delivery_Location: delivery_location || '',
      Delivery_Charges: delivery_charges || '',
      'Delivery Charges': delivery_charges || '',
      Delivery_Charge_Amount: delivery_charges === 'Chargeable' ? (delivery_charge_amount || '') : '',
      Is_Customer_Reimbursable: is_reimbursable || 'No',
      Total_Incl_GST: totalIncGST.toFixed(2),
      Status_Code: 'PR_SUBMITTED',
      Status_Label: 'PR Submitted',
      Last_Action_By: raised_by,
      Last_Action_At: timestamp,
      Approver_Remarks: '',
      Expected_Delivery_Date: expected_delivery || '',
      Warranty_AMC: warranty_amc || '',
      Quality: quality_terms || '',
      Quality_Terms: quality_terms || '',
      Special: special_terms || '',
      Special_Terms: special_terms || '',
      'Other Terms': other_terms || '',
      Other_Terms: other_terms || '',
      Requisition_By: requisitioned_by || '',
      PR_Approved_By: '',
      PR_Approved_DateTime: '',
      Procurement_Type: procurement_type || 'Goods',
      Has_Freight: freight_amount ? 'Yes' : 'No',
      Freight_Amount: freight_amount || 0,
      Has_Installation: installation_amount ? 'Yes' : 'No',
      Installation_Amount: installation_amount || 0,
      'Upload Quotation': upload_quotation || '',
      'Final Agreed PI': final_agreed_pi || '',
      'Supporting Docs': supporting_docs || '',
      Vendor_Ord_ref_no: vendor_order_ref_no || '',
      Remarks: remarks || '',
    };

    const prRow = headers.length > 0
      ? headers.map((h: string) => fieldMap[h] ?? '')
      : Object.values(fieldMap);

    await writeNewRow('PR_Master', prRow);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rate = parseFloat(item.rate) || 0;
      const qty = parseFloat(item.qty) || 0;
      const gst = parseFloat(item.gst) || 0;
      const lineTotal = qty * rate * (1 + gst / 100);
      await writeNewRow('PR_Items', [
        pr_id, i + 1, item.name, item.purpose || '', qty,
        item.uom, rate, gst, item.warranty || '', lineTotal.toFixed(2),
      ]);
    }

    // Fire-and-forget email notification. A failure here must not break PR creation.
    try {
      const baseUrl =
        process.env.APP_BASE_URL ||
        (req.headers.get('x-forwarded-proto') && req.headers.get('host')
          ? `${req.headers.get('x-forwarded-proto')}://${req.headers.get('host')}`
          : '');
      const { subject, html } = buildPrSubmittedEmail({
        pr_id,
        site,
        category,
        procurement_type: procurement_type || '',
        requested_by: raised_by,
        vendor_id: vendor_id || '',
        pr_purpose: purpose || '',
        total_incl_gst: totalIncGST.toFixed(2),
        expected_delivery: expected_delivery || '',
        payment_terms: specific_payment_terms || paymentSummary || '',
        app_base_url: baseUrl,
      });
      // No await: don't block the response on the email round-trip.
      sendEventEmail({
        eventKey: 'PR_SUBMITTED',
        subject,
        html,
        extraTo: currentUser.email ? [currentUser.email] : [],
      }).catch(err => console.error('[email] PR_SUBMITTED failed:', err));
    } catch (emailErr) {
      console.error('[email] PR_SUBMITTED prep failed:', emailErr);
    }

    return NextResponse.json({ pr_id, success: true });
  } catch (e: any) {
    console.error('PR POST failed:', e);
    return NextResponse.json({ error: e.message || 'Failed to create PR' }, { status: 500 });
  }
}
