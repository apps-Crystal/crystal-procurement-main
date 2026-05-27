import { NextRequest, NextResponse } from 'next/server';
import { batchRead, rowsToObjects } from '@/lib/sheets';

function parseNum(s: string | undefined): number {
  if (!s) return 0;
  return parseFloat(String(s).replace(/[₹,\s]/g, '')) || 0;
}

function parseDate(s: string | undefined): number {
  if (!s) return 0;
  const d = s.split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d).getTime();
  const parts = d.split('/');
  if (parts.length === 3 && parts[2].length === 4)
    return new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`).getTime();
  return new Date(s).getTime() || 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const site = searchParams.get('site');

    const data = await batchRead(['PR_Master', 'PO_Master', 'PO_Items', 'GRN_Master', 'GRN_Items']);
    let prs = rowsToObjects(data['PR_Master']);
    let pos = rowsToObjects(data['PO_Master']);
    const poItems = rowsToObjects(data['PO_Items']);
    let grns = rowsToObjects(data['GRN_Master']);
    const grnItems = rowsToObjects(data['GRN_Items']);

    if (site && site !== 'all') {
      prs = prs.filter(p => p.Site === site);
      pos = pos.filter(p => p.Site === site);
      grns = grns.filter(g => g.Site === site);
    }

    const now = Date.now();

    // Pipeline counts
    const prsAwaitingApproval = prs.filter(p => p.Status_Code === 'PR_SUBMITTED').length;
    const prsApprovedNoPO = prs.filter(p => p.Status_Code === 'PR_APPROVED').length;
    const posActive = pos.filter(p => p.Status_Code === 'PO_POSTED').length;
    const grnsPendingApproval = grns.filter(g => g.Status === 'Open' || g.Status === 'Draft').length;
    const grnsApprovedThisMonth = grns.filter(g => {
      if (g.Status !== 'Approved') return false;
      const ts = parseDate(g.Last_Action_At);
      return ts && (now - ts) < 30 * 86400000;
    }).length;

    // PO value this month
    const poValueMTD = pos.filter(p => {
      const ts = parseDate(p.PO_Date);
      return ts && (now - ts) < 30 * 86400000;
    }).reduce((s, p) => s + parseNum(p.Total_Incl_GST), 0);

    // Action items
    const actions: any[] = [];

    // Overdue PRs (>3 days)
    prs.filter(p => p.Status_Code === 'PR_SUBMITTED').forEach(pr => {
      const ts = parseDate(pr.Timestamp);
      const days = ts ? Math.floor((now - ts) / 86400000) : 0;
      if (days >= 3) actions.push({ type: 'pr_overdue', id: pr.PR_ID, label: pr.PR_Purpose, days, site: pr.Site, amount: pr.Total_Incl_GST });
    });

    // Delayed deliveries
    pos.filter(p => p.Status_Code === 'PO_POSTED').forEach(po => {
      const exp = parseDate(po.Expected_Delivery_Date);
      if (exp && exp < now) {
        const myGRNs = grns.filter(g => g.PO_ID === po.PO_ID && g.Status === 'Approved');
        if (myGRNs.length === 0) {
          const days = Math.floor((now - exp) / 86400000);
          actions.push({ type: 'delivery_delayed', id: po.PO_ID, label: po.Vendor_Company_Name, days, site: po.Site });
        }
      }
    });

    // GRNs without invoice
    grns.filter(g => g.Status === 'Approved' && !g['Invoice_URL']).forEach(grn => {
      const ts = parseDate(grn.Created_At);
      const days = ts ? Math.floor((now - ts) / 86400000) : 0;
      if (days > 3) actions.push({ type: 'bill_missing', id: grn.GRN_ID, label: grn.Vendor_ID, days, site: grn.Site });
    });

    // GRNs on QC hold
    grns.filter(g => g.Flag_Status === 'Flagged').forEach(grn => {
      actions.push({ type: 'qc_hold', id: grn.GRN_ID, label: grn.Vendor_ID, site: grn.Site });
    });

    // Site breakdown
    const sites = [...new Set([...prs.map(p => p.Site), ...pos.map(p => p.Site), ...grns.map(g => g.Site)].filter(Boolean))];
    const siteBreakdown = sites.map(s => ({
      site: s,
      open_prs: prs.filter(p => p.Site === s && p.Status_Code === 'PR_SUBMITTED').length,
      active_pos: pos.filter(p => p.Site === s && p.Status_Code === 'PO_POSTED').length,
      pending_grns: grns.filter(g => g.Site === s && (g.Status === 'Open' || g.Status === 'Draft')).length,
      po_value_mtd: pos.filter(p => {
        if (p.Site !== s) return false;
        const ts = parseDate(p.PO_Date);
        return ts && (now - ts) < 30 * 86400000;
      }).reduce((sum, p) => sum + parseNum(p.Total_Incl_GST), 0),
    }));

    return NextResponse.json({
      pipeline: { prsAwaitingApproval, prsApprovedNoPO, posActive, grnsPendingApproval, grnsApprovedThisMonth },
      poValueMTD,
      actions: actions.slice(0, 10),
      siteBreakdown,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
