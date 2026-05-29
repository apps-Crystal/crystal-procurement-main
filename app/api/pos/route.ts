import { NextRequest, NextResponse } from 'next/server';
import { readSheet, rowsToObjects, writeNewRow, getNextId, getDrive } from '@/lib/sheets';
import { getCurrentUser } from '@/lib/current-user';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const site = searchParams.get('site');
    const status = searchParams.get('status');

    const [poRows, grnRows, grnItemRows, poItemRows] = await Promise.all([
      readSheet('PO_Master'),
      readSheet('GRN_Master'),
      readSheet('GRN_Items'),
      readSheet('PO_Items'),
    ]);

    let pos = rowsToObjects(poRows);
    const grns = rowsToObjects(grnRows);
    const grnItems = rowsToObjects(grnItemRows);
    const poItems = rowsToObjects(poItemRows);

    // Drop ghost rows (no PO_ID) left over from earlier broken submissions.
    pos = pos.filter(p => p.PO_ID && p.PO_ID.trim());

    if (site && site !== 'all') pos = pos.filter(p => p.Site === site);
    if (status && status !== 'all') pos = pos.filter(p => p.Status_Code === status);

    // Enrich with delivery status
    pos = pos.map(po => {
      const myGRNs = grns.filter(g => g.PO_ID === po.PO_ID);
      const myPOItems = poItems.filter(i => i.PO_ID === po.PO_ID);
      const myGRNItems = grnItems.filter(i => i.PO_ID === po.PO_ID);

      const totalOrdered = myPOItems.reduce((s, i) => s + (parseFloat(i.Qty) || 0), 0);
      const totalReceived = myGRNItems.reduce((s, i) => s + (parseFloat(i.Received_Qty) || 0), 0);
      const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

      // Delivery delay
      let delayDays = 0;
      if (po.Expected_Delivery_Date && myGRNs.length === 0) {
        const d = po.Expected_Delivery_Date.split(' ')[0];
        const parts = d.split('/');
        const iso = parts.length === 3 && parts[2].length === 4
          ? `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
          : d;
        const exp = new Date(iso).getTime();
        if (exp && exp < Date.now()) delayDays = Math.floor((Date.now() - exp) / 86400000);
      }

      return { ...po, received_pct: String(pct), total_ordered: String(totalOrdered), total_received: String(totalReceived), delay_days: String(delayDays), grn_count: String(myGRNs.length) };
    });

    pos.reverse();
    return NextResponse.json({ pos });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pr_id, site, vendor_id, vendor_name, tally_no, po_date, payment_terms,
      delivery_terms, expected_delivery_date, remarks, freight_amount, installation_amount,
      items, po_pdf_url, po_pdf_file_id } = body;

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const created_by = currentUser.name?.trim() || currentUser.email;

    const now = new Date();
    const month = now.toLocaleString('en-IN', { month: 'long', timeZone: 'Asia/Kolkata' })
      + now.toLocaleString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' });
    const counter = await getNextId('PO', site, month);
    const po_id = `PO-${site}-${month}/${counter}`;
    const timestamp = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Rename the uploaded PO PDF in Drive to embed PO_ID + Site in the name.
    // Best-effort: failure here should not block the PO creation.
    let finalPdfUrl = po_pdf_url || '';
    if (po_pdf_file_id) {
      try {
        const drive = await getDrive();
        const meta = await drive.files.get({ fileId: po_pdf_file_id, fields: 'name', supportsAllDrives: true });
        const origName = meta.data.name || '';
        const dotIdx = origName.lastIndexOf('.');
        const ext = dotIdx > -1 ? origName.slice(dotIdx) : '';
        const safePoId = po_id.replace(/[\\/]/g, '-');
        const newName = `PO_${site}_${safePoId}${ext}`;
        await drive.files.update({
          fileId: po_pdf_file_id,
          requestBody: { name: newName },
          supportsAllDrives: true,
        });
      } catch (renameErr) {
        console.warn('PO PDF rename failed (continuing):', renameErr);
      }
    }

    const totalIncGST = items?.reduce((sum: number, item: any) => {
      const rate = parseFloat(item.rate) || 0;
      const qty = parseFloat(item.qty) || 0;
      const gst = parseFloat(item.gst) || 0;
      return sum + (qty * rate * (1 + gst / 100));
    }, 0) || 0;

    // Read existing headers to build row in correct column order
    const existingRows = await readSheet('PO_Master');
    const headers = existingRows.length > 0 ? existingRows[0] : [];

    const fieldMap: Record<string, any> = {
      PO_ID: po_id,
      PR_ID: pr_id,
      Site: site,
      Vendor_ID: vendor_id,
      PO_No_Tally: tally_no || '',
      PO_Date: po_date,
      Payment_Terms: payment_terms || '',
      Delivery_Terms: delivery_terms || '',
      Expected_Delivery_Date: expected_delivery_date || '',
      Total_Incl_GST: totalIncGST.toFixed(2),
      Status_Code: 'PO_POSTED',
      Status_Label: 'Posted',
      Created_By: created_by,
      Timestamp: timestamp,
      Last_Action_By: created_by,
      Last_Action_At: timestamp,
      Remarks: remarks || '',
      Has_Freight: freight_amount ? 'Yes' : 'No',
      Freight_Amount: freight_amount || 0,
      Has_Installation: installation_amount ? 'Yes' : 'No',
      Installation_Amount: installation_amount || 0,
      Vendor_Company_Name: vendor_name || '',
      PO_FileId: po_pdf_file_id || '',
      PO_File_URL: finalPdfUrl,
    };

    const poRow = headers.length > 0
      ? headers.map((h: string) => fieldMap[h] ?? '')
      : Object.values(fieldMap);

    await writeNewRow('PO_Master', poRow);

    for (let i = 0; i < (items || []).length; i++) {
      const item = items[i];
      const rate = parseFloat(item.rate) || 0;
      const qty = parseFloat(item.qty) || 0;
      const gst = parseFloat(item.gst) || 0;
      await writeNewRow('PO_Items', [po_id, i + 1, item.name, qty, item.uom, rate, gst, (qty * rate * (1 + gst / 100)).toFixed(2)]);
    }

    // Update PR status to PO_POSTED
    const prRows = await readSheet('PR_Master');
    const prHeaders = prRows[0];
    const { findRowIndex, updateRow } = await import('@/lib/sheets');
    const rowIdx = findRowIndex(prRows, prHeaders.indexOf('PR_ID'), pr_id);
    if (rowIdx > 0) {
      const row = prRows[rowIdx - 1];
      row[prHeaders.indexOf('Status_Code')] = 'PO_POSTED';
      row[prHeaders.indexOf('Status_Label')] = 'PO Posted';
      row[prHeaders.indexOf('Last_Action_By')] = created_by;
      row[prHeaders.indexOf('Last_Action_At')] = timestamp;
      await updateRow(`PR_Master!A${rowIdx}`, row);
    }

    return NextResponse.json({ po_id, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
