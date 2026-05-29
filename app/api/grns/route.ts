import { NextRequest, NextResponse } from 'next/server';
import { readSheet, rowsToObjects, writeNewRow, getNextId, getDrive } from '@/lib/sheets';
import { getCurrentUser } from '@/lib/current-user';

type UploadedDoc = { url: string; file_id: string };

async function renameDriveFile(fileId: string, newBaseName: string): Promise<void> {
  try {
    const drive = await getDrive();
    const meta = await drive.files.get({ fileId, fields: 'name', supportsAllDrives: true });
    const origName = meta.data.name || '';
    const dotIdx = origName.lastIndexOf('.');
    const ext = dotIdx > -1 ? origName.slice(dotIdx) : '';
    await drive.files.update({
      fileId,
      requestBody: { name: `${newBaseName}${ext}` },
      supportsAllDrives: true,
    });
  } catch (err) {
    console.warn(`Drive rename failed for ${fileId}:`, err);
  }
}

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

    // Drop ghost rows (no GRN_ID) left over from earlier broken submissions.
    grns = grns.filter(g => g.GRN_ID && g.GRN_ID.trim());

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
      lr_number, vehicle_number, items,
      invoice, lr_doc, photos, other_docs } = body as {
        po_id: string; site: string; vendor_id: string;
        invoice_number: string; invoice_value: string | number; invoice_date: string;
        lr_number: string; vehicle_number: string; items: any[];
        invoice: UploadedDoc | null;
        lr_doc: UploadedDoc | null;
        photos: UploadedDoc[];
        other_docs: UploadedDoc[];
      };

    if (!invoice || !invoice.url) {
      return NextResponse.json({ error: 'Invoice document is required' }, { status: 400 });
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const created_by_name = currentUser.name?.trim() || currentUser.email;
    const created_by_email = currentUser.email;

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

    // Rename uploaded Drive files now that we have the GRN_ID.
    const safeGrnId = grn_id.replace(/[\\/]/g, '-');
    const safeLrNumber = (lr_number || '').replace(/[\\/\s]+/g, '-');
    if (invoice.file_id) {
      await renameDriveFile(invoice.file_id, `${site}_${safeGrnId}`);
    }
    if (lr_doc?.file_id) {
      await renameDriveFile(lr_doc.file_id, `${safeGrnId}_${safeLrNumber || 'LR'}`);
    }
    for (let i = 0; i < (photos || []).length; i++) {
      if (photos[i]?.file_id) {
        await renameDriveFile(photos[i].file_id, `${safeGrnId}_PHOTO_${i + 1}`);
      }
    }
    for (let i = 0; i < (other_docs || []).length; i++) {
      if (other_docs[i]?.file_id) {
        await renameDriveFile(other_docs[i].file_id, `${safeGrnId}_DOC_${i + 1}`);
      }
    }

    const photoUrls = (photos || []).map(p => p.url).filter(Boolean).join('\n');
    const otherUrls = (other_docs || []).map(d => d.url).filter(Boolean).join('\n');

    // Header-based row build. Any sheet header that doesn't appear in this
    // map writes an empty string — guesses for older field names are included
    // in both common stylings so existing columns stay populated.
    const headerRows = await readSheet('GRN_Master');
    const headers = headerRows.length > 0 ? headerRows[0] : [];

    const fieldMap: Record<string, any> = {
      GRN_ID: grn_id,
      PO_ID: po_id,
      Site: site,
      Vendor_ID: vendor_id,
      'Invoice Number': invoice_number,
      Invoice_Number: invoice_number,
      'Invoice Value': invoice_value,
      Invoice_Value: invoice_value,
      LR_Number: lr_number,
      Invoice_Date: invoice_date,
      Vehicle_Number: vehicle_number,
      Created_At: timestamp,
      Timestamp: timestamp,
      Last_Updated: timestamp,
      Created_By_Email: created_by_email,
      Created_By_Name: created_by_name,
      Last_Action_By_Email: created_by_email,
      Last_Action_By_Name: created_by_name,
      Last_Action_At: timestamp,
      Status: 'Draft',
      Invoice_URL: invoice.url,
      'LR/ Delivery Challan_URL': lr_doc?.url || '',
      Photos_URL: photoUrls,
      Other_Docs_URL: otherUrls,
    };

    const grnRow = headers.length > 0
      ? headers.map((h: string) => fieldMap[h] ?? '')
      : Object.values(fieldMap);

    await writeNewRow('GRN_Master', grnRow);

    for (let i = 0; i < (items || []).length; i++) {
      const item = items[i];
      const balance = (parseFloat(item.ordered_qty) || 0) - (parseFloat(item.received_qty) || 0);
      await writeNewRow('GRN_Items', [
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
