import { NextRequest, NextResponse } from 'next/server';
import { readSheet, rowsToObjects, findRowIndex, updateRow } from '@/lib/sheets';
import { getCurrentUser } from '@/lib/current-user';

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
    const { action, remarks } = body;

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const approver = currentUser.name?.trim() || currentUser.email;

    const rows = await readSheet('PR_Master');
    const headers = rows[0];
    const rowIdx = findRowIndex(rows, headers.indexOf('PR_ID'), decodedId);
    if (rowIdx === -1) return NextResponse.json({ error: 'PR not found' }, { status: 404 });

    const statusCodeCol = headers.indexOf('Status_Code');
    const statusLabelCol = headers.indexOf('Status_Label');
    const actionByCol = headers.indexOf('Last_Action_By');
    const actionAtCol = headers.indexOf('Last_Action_At');
    const remarksCol = headers.indexOf('Approver_Remarks');
    const approvedByCol = headers.indexOf('PR_Approved_By');
    const approvedAtCol = headers.indexOf('PR_Approved_DateTime');

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const row = rows[rowIdx - 1];

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
    return NextResponse.json({ success: true, status: statusMap[action][0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
