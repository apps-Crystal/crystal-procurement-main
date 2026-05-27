import { NextRequest, NextResponse } from 'next/server';
import { batchRead, rowsToObjects } from '@/lib/sheets';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const poId = decodeURIComponent(id);

    const data = await batchRead(['PO_Master', 'PO_Items', 'GRN_Master', 'GRN_Items', 'PR_Master', 'Vendor_Master']);

    const pos = rowsToObjects(data['PO_Master']);
    const po = pos.find(p => p.PO_ID === poId);
    if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });

    const allPoItems = rowsToObjects(data['PO_Items']);
    const allGrnItems = rowsToObjects(data['GRN_Items']);
    const allGrns = rowsToObjects(data['GRN_Master']);

    const poItems = allPoItems.filter(i => i.PO_ID === poId);
    const grns = allGrns.filter(g => g.PO_ID === poId);
    const grnItems = allGrnItems.filter(i => i.PO_ID === poId);

    // Enrich PO items with received/defective totals
    const enrichedItems = poItems.map(item => {
      const related = grnItems.filter(g =>
        g.Item_Name?.trim().toLowerCase() === item.Item_Name?.trim().toLowerCase()
      );
      const received = related.reduce((s, g) => s + (parseFloat(g.Received_Qty) || 0), 0);
      const defective = related.reduce((s, g) => s + (parseFloat(g.Defective_Qty) || 0), 0);
      const ordered = parseFloat(item.Qty) || 0;
      return {
        ...item,
        total_received: String(received),
        total_defective: String(defective),
        balance: String(Math.max(0, ordered - received)),
        received_pct: ordered > 0 ? String(Math.round((received / ordered) * 100)) : '0',
      };
    });

    // Enrich GRNs with vendor name
    const vendors = rowsToObjects(data['Vendor_Master']);
    const vendor = vendors.find(v => v.Vendor_ID === po.Vendor_ID);
    const enrichedGrns = grns.map(g => ({
      ...g,
      vendor_name: vendor?.Company_Name || g.Vendor_ID,
    }));

    // Get parent PR
    const prs = rowsToObjects(data['PR_Master']);
    const pr = prs.find(p => p.PR_ID === po.PR_ID);

    // Delivery status
    const now = Date.now();
    let delayDays = 0;
    const approvedGrns = grns.filter(g => g.Status === 'Approved');
    if (po.Expected_Delivery_Date && approvedGrns.length === 0) {
      const d = po.Expected_Delivery_Date.split(' ')[0];
      const parts = d.split('/');
      const iso = parts.length === 3 && parts[2].length === 4
        ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : d;
      const exp = new Date(iso).getTime();
      if (exp && exp < now) delayDays = Math.floor((now - exp) / 86400000);
    }

    const totalOrdered = poItems.reduce((s, i) => s + (parseFloat(i.Qty) || 0), 0);
    const totalReceived = enrichedItems.reduce((s, i) => s + (parseFloat(i.total_received) || 0), 0);
    const receivedPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

    return NextResponse.json({ po, items: enrichedItems, grns: enrichedGrns, pr, vendor, delayDays, receivedPct });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
