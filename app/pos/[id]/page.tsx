'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function fmt(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n.replace(/[₹,]/g, '')) : n;
  if (!v || isNaN(v)) return '—';
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const STATUS: Record<string, string> = {
  PO_POSTED: 'bg-blue-100 text-blue-700',
  ARCHIVED: 'bg-gray-100 text-gray-600',
};

const GRN_STATUS: Record<string, string> = {
  Draft: 'bg-yellow-100 text-yellow-700',
  Open: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Flagged: 'bg-red-100 text-red-700',
};

export default function PODetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pos/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data?.po) return (
    <div className="flex-1 flex items-center justify-center text-gray-400">PO not found</div>
  );

  const { po, items, grns, pr, vendor, delayDays, receivedPct } = data;
  const badgeCls = STATUS[po.Status_Code] || 'bg-gray-100 text-gray-600';
  const approvedGrns = grns.filter((g: any) => g.Status === 'Approved');

  const steps = [
    { label: 'PR Submitted', done: true, info: pr?.Timestamp?.split(',')[0] || '' },
    { label: 'PR Approved', done: true, info: pr?.PR_Approved_By || 'Approved' },
    { label: 'PO Created', done: true, info: `${po.PO_Date} · ${po.Created_By || ''}` },
    {
      label: 'Delivery',
      done: approvedGrns.length > 0,
      active: approvedGrns.length === 0,
      info: delayDays > 0 ? `${delayDays}d overdue` : `Expected: ${po.Expected_Delivery_Date || '—'}`,
    },
    {
      label: 'GRN Complete',
      done: receivedPct >= 100,
      active: approvedGrns.length > 0 && receivedPct < 100,
      info: receivedPct > 0 ? `${receivedPct}% received` : 'Pending',
    },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 sticky top-0 z-10">
        <Link href="/pos" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-1">← Purchase Orders</Link>
      </div>

      <div className="px-4 py-4 md:px-7 md:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold font-mono">{po.PO_ID}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeCls}`}>{po.Status_Label || po.Status_Code}</span>
              {delayDays > 0 && <span className="text-xs font-semibold text-red-500">{delayDays}d delivery overdue</span>}
            </div>
            <div className="text-sm text-gray-500">{po.Site} · {po.Vendor_Company_Name || po.Vendor_ID} · {po.PO_Date}</div>
          </div>
          <div className="flex gap-2">
            {pr && (
              <Link href={`/prs/${encodeURIComponent(pr.PR_ID)}`}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                View PR →
              </Link>
            )}
            <Link href={`/grns/new?po=${encodeURIComponent(po.PO_ID)}`}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
              + New GRN
            </Link>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* PO Details */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">PO Details</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                {([
                  ['Tally No.', po.PO_No_Tally],
                  ['PO Date', po.PO_Date],
                  ['Site', po.Site],
                  ['PR Reference', po.PR_ID],
                  ['Expected Delivery', po.Expected_Delivery_Date],
                  ['Created By', po.Created_By],
                  ['Payment Terms', po.Payment_Terms],
                  ['Delivery Terms', po.Delivery_Terms],
                  ['Remarks', po.Remarks],
                  ...(po.Has_Freight === 'Yes' ? [['Freight', fmt(po.Freight_Amount)]] : []),
                  ...(po.Has_Installation === 'Yes' ? [['Installation', fmt(po.Installation_Amount)]] : []),
                ] as [string, string][]).map(([label, value]) => value ? (
                  <div key={label}>
                    <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                    <div className="font-medium">{value}</div>
                  </div>
                ) : null)}
              </div>
            </div>

            {/* Line Items with delivery tracking */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Line Items — Delivery Tracker
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400">
                      <th className="text-left pb-2">#</th>
                      <th className="text-left pb-2">Item</th>
                      <th className="text-right pb-2">Ordered</th>
                      <th className="text-right pb-2">Received</th>
                      <th className="text-right pb-2">Defective</th>
                      <th className="text-right pb-2">Balance</th>
                      <th className="text-left pb-2 pl-2">UOM</th>
                      <th className="text-right pb-2">Rate</th>
                      <th className="text-right pb-2">Total</th>
                      <th className="text-left pb-2 pl-3">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items?.map((item: any) => {
                      const pct = parseInt(item.received_pct) || 0;
                      const bal = parseFloat(item.balance) || 0;
                      return (
                        <tr key={item.Line_No} className="border-b border-gray-50">
                          <td className="py-2.5 text-gray-400 text-xs">{item.Line_No}</td>
                          <td className="py-2.5 font-medium">{item.Item_Name}</td>
                          <td className="py-2.5 text-right">{item.Qty}</td>
                          <td className={`py-2.5 text-right font-medium ${parseFloat(item.total_received) > 0 ? 'text-green-600' : 'text-gray-400'}`}>{item.total_received || '0'}</td>
                          <td className={`py-2.5 text-right ${parseFloat(item.total_defective) > 0 ? 'text-red-500 font-medium' : 'text-gray-300'}`}>{item.total_defective || '0'}</td>
                          <td className={`py-2.5 text-right font-medium ${bal > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{bal > 0 ? bal : '—'}</td>
                          <td className="py-2.5 text-gray-500 pl-2 text-xs">{item.UOM}</td>
                          <td className="py-2.5 text-right text-gray-500">{fmt(item.Rate)}</td>
                          <td className="py-2.5 text-right font-medium">{fmt(item.Line_Total)}</td>
                          <td className="py-2.5 pl-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-400' : 'bg-indigo-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="text-xs text-gray-400">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td colSpan={8} className="pt-3 text-right font-semibold text-sm">Grand Total (incl. GST)</td>
                      <td className="pt-3 text-right font-bold text-base">{fmt(po.Total_Incl_GST)}</td>
                      <td className="pt-3 pl-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${receivedPct >= 100 ? 'bg-green-400' : 'bg-indigo-400'}`} style={{ width: `${Math.min(receivedPct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 font-semibold">{receivedPct}%</span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* GRN History */}
            {grns.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">GRN History ({grns.length})</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400">
                      <th className="text-left pb-2">GRN ID</th>
                      <th className="text-left pb-2">Invoice No.</th>
                      <th className="text-right pb-2">Invoice Value</th>
                      <th className="text-left pb-2">Date</th>
                      <th className="text-left pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grns.map((grn: any) => (
                      <tr key={grn.GRN_ID} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/grns/${encodeURIComponent(grn.GRN_ID)}`)}>

                        <td className="py-2.5 font-mono text-xs text-indigo-600 font-medium">{grn.GRN_ID}</td>
                        <td className="py-2.5 text-gray-600">{grn['Invoice Number'] || '—'}</td>
                        <td className="py-2.5 text-right font-medium">{fmt(grn['Invoice Value'] || grn.Invoice_Value)}</td>
                        <td className="py-2.5 text-gray-500 text-xs">{grn.Invoice_Date || grn.Created_At?.split(' ')[0]}</td>
                        <td className="py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${GRN_STATUS[grn.Status] || 'bg-gray-100 text-gray-600'}`}>{grn.Status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
            {/* Lifecycle */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Lifecycle</div>
              <div className="space-y-1">
                {steps.map((step: any, i) => (
                  <div key={step.label}>
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5
                        ${step.done ? 'bg-green-500 text-white' : step.active ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        {step.done ? '✓' : i + 1}
                      </div>
                      <div className="pb-3">
                        <div className={`text-sm font-medium ${step.done ? 'text-green-700' : step.active ? 'text-amber-700' : 'text-gray-400'}`}>{step.label}</div>
                        <div className="text-xs text-gray-400">{step.info}</div>
                      </div>
                    </div>
                    {i < steps.length - 1 && <div className="w-0.5 bg-gray-100 h-3 ml-3" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Summary</div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Value</span>
                  <span className="font-bold text-base">{fmt(po.Total_Incl_GST)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GRNs Raised</span>
                  <span className="font-medium">{grns.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivered</span>
                  <span className={`font-medium ${receivedPct >= 100 ? 'text-green-600' : 'text-amber-600'}`}>{receivedPct}%</span>
                </div>
                {delayDays > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Delivery Delay</span>
                    <span className="font-medium text-red-500">{delayDays} days</span>
                  </div>
                )}
              </div>
            </div>

            {/* Vendor */}
            {vendor && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Vendor</div>
                <Link href={`/vendors/${encodeURIComponent(vendor.Vendor_ID)}`} className="font-medium text-sm text-indigo-600 hover:underline mb-2 block">
                  {vendor.Company_Name}
                </Link>
                <div className="space-y-1.5 text-xs text-gray-500">
                  {vendor.Contact_Person && <div>👤 {vendor.Contact_Person}</div>}
                  {vendor.Contact_Number && <div>📞 {vendor.Contact_Number}</div>}
                  {vendor.Email_ID && <div>✉️ {vendor.Email_ID}</div>}
                  {vendor.GST_Number && <div>GST: {vendor.GST_Number}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
