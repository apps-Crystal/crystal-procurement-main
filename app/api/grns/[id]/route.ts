import { NextRequest, NextResponse } from 'next/server';
import { batchRead, readSheet, rowsToObjects, updateRow, findRowIndex } from '@/lib/sheets';
import { getCurrentUser } from '@/lib/current-user';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const grnId = decodeURIComponent(id);

    const data = await batchRead(['GRN_Master', 'GRN_Items', 'PO_Master', 'PO_Items', 'Vendor_Master']);

    const grns = rowsToObjects(data['GRN_Master']);
    const grn = grns.find(g => g.GRN_ID === grnId);
    if (!grn) return NextResponse.json({ error: 'GRN not found' }, { status: 404 });

    const items = rowsToObjects(data['GRN_Items']).filter(i => i.GRN_ID === grnId);
    const pos = rowsToObjects(data['PO_Master']);
    const po = pos.find(p => p.PO_ID === grn.PO_ID);
    const vendors = rowsToObjects(data['Vendor_Master']);
    const vendor = vendors.find(v => v.Vendor_ID === grn.Vendor_ID);

    // Attach PO items for context
    const poItems = rowsToObjects(data['PO_Items']).filter(i => i.PO_ID === grn.PO_ID);

    return NextResponse.json({ grn, items, po, vendor, poItems });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const grnId = decodeURIComponent(id);
    const body = await req.json();
    const { action, remarks } = body;

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const actorName = currentUser.name?.trim() || currentUser.email;
    const actorEmail = currentUser.email;

    const rows = await readSheet('GRN_Master');
    const headers = rows[0];
    const rowIdx = findRowIndex(rows, headers.indexOf('GRN_ID'), grnId);
    if (rowIdx < 0) return NextResponse.json({ error: 'GRN not found' }, { status: 404 });

    const row = [...rows[rowIdx - 1]];
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    function setCol(col: string, val: string) {
      const i = headers.indexOf(col);
      if (i >= 0) row[i] = val;
    }

    if (action === 'approve') {
      setCol('Status', 'Approved');
      setCol('Approved_By', actorName);
      setCol('Approved_By_Name', actorName);
      setCol('Approved_By_Email', actorEmail);
      setCol('Approved_At', now);
      setCol('Approver_Remarks', remarks || '');
    } else if (action === 'reject') {
      setCol('Status', 'Rejected');
      setCol('Rejected_By', actorName);
      setCol('Rejected_By_Name', actorName);
      setCol('Rejected_By_Email', actorEmail);
      setCol('Rejected_At', now);
      setCol('Rejection_Reason', remarks || '');
      setCol('Approver_Remarks', remarks || '');
    } else if (action === 'flag') {
      setCol('Status', 'Flagged');
      setCol('Flag_Status', 'Flagged');
      setCol('Flag_Reason', remarks || '');
    } else if (action === 'submit') {
      setCol('Status', 'Open');
    }

    setCol('Last_Action_At', now);
    setCol('Last_Action_By', actorName);
    setCol('Last_Action_By_Name', actorName);
    setCol('Last_Action_By_Email', actorEmail);

    await updateRow(`GRN_Master!A${rowIdx}`, row);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
