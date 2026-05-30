import { NextRequest, NextResponse } from 'next/server';
import { readSheet, rowsToObjects, findRowIndex, updateRow } from '@/lib/sheets';
import { getCurrentUser } from '@/lib/current-user';
import { sendEventEmail, buildPrApprovedEmail } from '@/lib/email';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);

    const [prRows, itemRows, vendorRows, poRows] = await Promise.all([
      readSheet('PR_Master'),
      readSheet('PR_Items'),
      readSheet('Vendor_Master'),
      readSheet('PO_Master'),
    ]);

    const prs = rowsToObjects(prRows);
    const pr = prs.find(p => p.PR_ID === decodedId);
    if (!pr) return NextResponse.json({ error: 'PR not found' }, { status: 404 });

    const items = rowsToObjects(itemRows).filter(i => i.PR_ID === decodedId);
    const vendor = rowsToObjects(vendorRows).find(v => v.Vendor_ID === pr.Vendor_ID);
    const pos = rowsToObjects(poRows).filter(p => p.PR_ID === decodedId);

    // Aging
    const ts = pr.Timestamp ? new Date(pr.Timestamp.split(' ')[0].split('/').reverse().join('-')).getTime() : 0;
    const agingDays = ts ? Math.floor((Date.now() - ts) / 86400000) : 0;

    return NextResponse.json({ pr: { ...pr, aging_days: agingDays }, items, vendor: vendor || null, pos });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const body = await req.json();
    const { action, remarks, updates } = body;

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const approver = currentUser.name?.trim() || currentUser.email;

    const rows = await readSheet('PR_Master');
    const headers = rows[0];
    const rowIdx = findRowIndex(rows, headers.indexOf('PR_ID'), decodedId);
    if (rowIdx === -1) return NextResponse.json({ error: 'PR not found' }, { status: 404 });

    const actionByCol = headers.indexOf('Last_Action_By');
    const actionAtCol = headers.indexOf('Last_Action_At');
    const remarksCol = headers.indexOf('Approver_Remarks');
    const approvedByCol = headers.indexOf('PR_Approved_By');
    const approvedAtCol = headers.indexOf('PR_Approved_DateTime');
    const statusCodeCol = headers.indexOf('Status_Code');
    const statusLabelCol = headers.indexOf('Status_Label');

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const row = rows[rowIdx - 1];

    // Field edit
    if (action === 'update') {
      // Only allow edits while the PR is still in submitted state.
      const currentStatus = statusCodeCol >= 0 ? row[statusCodeCol] : '';
      if (currentStatus !== 'PR_SUBMITTED') {
        return NextResponse.json(
          { error: `PR cannot be edited once its status is ${currentStatus || 'changed'}` },
          { status: 403 },
        );
      }
      // Columns the user is not allowed to change directly.
      const locked = new Set([
        'PR_ID', 'Timestamp', 'Date_of_Requisition',
        'Status_Code', 'Status_Label',
        'Requested_By', 'PR_Approved_By', 'PR_Approved_DateTime',
        'Last_Action_By', 'Last_Action_At',
      ]);
      for (const [col, val] of Object.entries(updates || {})) {
        if (locked.has(col)) continue;
        const i = headers.indexOf(col);
        if (i >= 0) row[i] = val == null ? '' : String(val);
      }
      if (actionByCol >= 0) row[actionByCol] = approver;
      if (actionAtCol >= 0) row[actionAtCol] = now;
      await updateRow(`PR_Master!A${rowIdx}`, row);
      return NextResponse.json({ success: true });
    }

    // Approve / reject
    const statusMap: Record<string, [string, string]> = {
      approve: ['PR_APPROVED', 'PR Approved'],
      reject: ['PR_REJECTED', 'PR Rejected'],
    };

    if (!statusMap[action]) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    row[statusCodeCol] = statusMap[action][0];
    row[statusLabelCol] = statusMap[action][1];
    row[actionByCol] = approver;
    row[actionAtCol] = now;
    if (remarksCol >= 0) row[remarksCol] = remarks || '';
    if (action === 'approve') {
      if (approvedByCol >= 0) row[approvedByCol] = approver;
      if (approvedAtCol >= 0) row[approvedAtCol] = now;
    }

    await updateRow(`PR_Master!A${rowIdx}`, row);

    // Email on approval. Lookup the raiser's email from Requested_By field, plus extras.
    if (action === 'approve') {
      try {
        const idxOf = (col: string) => headers.indexOf(col);
        const updatedPr = {
          pr_id: decodedId,
          site: String(row[idxOf('Site')] || ''),
          category: String(row[idxOf('Purchase_Category')] || ''),
          requested_by: String(row[idxOf('Requested_By')] || ''),
          approved_by: approver,
          approved_at: now,
          approver_remarks: remarks || '',
          total_incl_gst: String(row[idxOf('Total_Incl_GST')] || ''),
          vendor_id: String(row[idxOf('Vendor_ID')] || ''),
        };
        const baseUrl =
          process.env.APP_BASE_URL ||
          (req.headers.get('x-forwarded-proto') && req.headers.get('host')
            ? `${req.headers.get('x-forwarded-proto')}://${req.headers.get('host')}`
            : '');
        const { subject, html } = buildPrApprovedEmail({ ...updatedPr, app_base_url: baseUrl });
        // Try to derive the requester's email from a few common columns
        const requesterEmailRaw =
          (idxOf('Requested_By_Email') >= 0 ? String(row[idxOf('Requested_By_Email')] || '') : '') ||
          (updatedPr.requested_by.includes('@') ? updatedPr.requested_by : '');
        sendEventEmail({
          eventKey: 'PR_APPROVED',
          subject,
          html,
          extraTo: requesterEmailRaw ? [requesterEmailRaw] : [],
        }).catch(err => console.error('[email] PR_APPROVED failed:', err));
      } catch (emailErr) {
        console.error('[email] PR_APPROVED prep failed:', emailErr);
      }
    }

    return NextResponse.json({ success: true, status: statusMap[action][0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
