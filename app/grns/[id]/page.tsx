'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

function fmt(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n.replace(/[₹,]/g, '')) : n;
  if (!v || isNaN(v)) return '—';
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const STATUS_BADGE: Record<string, string> = {
  Draft: 'bg-yellow-100 text-yellow-700',
  Open: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Flagged: 'bg-red-100 text-red-700',
};

const CONDITION_COLOR: Record<string, string> = {
  Good: 'text-green-600',
  Damaged: 'text-red-500',
  Partial: 'text-amber-600',
};

export default function GRNDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState<'approve' | 'flag'>('approve');
  const [remarks, setRemarks] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    fetch(`/api/grns/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [id]);

  async function doAction() {
    setActing(true);
    const res = await fetch(`/api/grns/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: modalAction, remarks }),
    });
    const result = await res.json();
    if (result.success) {
      setShowModal(false);
      const fresh = await fetch(`/api/grns/${encodeURIComponent(id)}`).then(r => r.json());
      setData(fresh);
    }
    setActing(false);
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data?.grn) return (
    <div className="flex-1 flex items-center justify-center text-gray-400">GRN not found</div>
  );

  const { grn, items, po, vendor } = data;
  const badgeCls = STATUS_BADGE[grn.Status] || 'bg-gray-100 text-gray-600';
  const canApprove = grn.Status === 'Draft' || grn.Status === 'Open';
  const totalReceived = (items as any[] | null)?.reduce((s: number, i: any) => s + (parseFloat(i.Received_Qty) || 0), 0) || 0;
  const totalDefective = (items as any[] | null)?.reduce((s: number, i: any) => s + (parseFloat(i.Defective_Qty) || 0), 0) || 0;

  return (
    <div className="flex-1 flex flex-col">
      {/* Approval modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full mx-4 shadow-2xl">
            <div className="font-semibold text-lg mb-1">
              {modalAction === 'approve' ? 'Approve GRN' : 'Flag GRN'}
            </div>
            <div className="text-sm text-gray-400 mb-4 font-mono">{grn.GRN_ID}</div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              {modalAction === 'flag' ? 'Flag Reason (required)' : 'Remarks (optional)'}
            </label>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-indigo-300"
              placeholder={modalAction === 'flag' ? 'Describe the issue...' : 'Optional remarks...'} />
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={doAction} disabled={acting || (modalAction === 'flag' && !remarks.trim())}
                className={`px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50 ${modalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {acting ? 'Saving...' : modalAction === 'approve' ? 'Approve GRN' : 'Flag GRN'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 sticky top-0 z-10">
        <Link href="/grns" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-1">← GRN</Link>
      </div>

      <div className="px-4 py-4 md:px-7 md:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold font-mono">{grn.GRN_ID}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeCls}`}>{grn.Status}</span>
            </div>
            <div className="text-sm text-gray-500">
              {grn.Site} · {vendor?.Company_Name || grn.Vendor_ID} · Invoice: {grn['Invoice Number'] || '—'}
            </div>
          </div>
          <div className="flex gap-2">
            {po && (
              <Link href={`/pos/${encodeURIComponent(po.PO_ID)}`}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                View PO →
              </Link>
            )}
            {canApprove && (
              <button onClick={() => { setModalAction('flag'); setShowModal(true); }}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50">
                Flag
              </button>
            )}
            {canApprove && (
              <button onClick={() => { setModalAction('approve'); setShowModal(true); }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
                Approve GRN
              </button>
            )}
            {grn.Status === 'Approved' && (
              <span className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-semibold">
                ✓ Approved by {grn.Approved_By || 'Site Person'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* GRN Details */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">GRN Details</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                {([
                  ['PO Reference', grn.PO_ID],
                  ['Site', grn.Site],
                  ['Invoice Number', grn['Invoice Number']],
                  ['Invoice Value', fmt(grn['Invoice Value'] || grn.Invoice_Value)],
                  ['Invoice Date', grn.Invoice_Date],
                  ['LR Number', grn.LR_Number],
                  ['Vehicle Number', grn.Vehicle_Number],
                  ['Created By', grn.Created_By_Name || grn.Created_By_Email],
                  ['Created At', grn.Created_At?.split(',')[0]],
                  ...(grn.Approver_Remarks ? [['Approver Remarks', grn.Approver_Remarks]] : []),
                  ...(grn.Flag_Reason ? [['Flag Reason', grn.Flag_Reason]] : []),
                ] as [string, string][]).map(([label, value]) => value ? (
                  <div key={label}>
                    <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                    <div className="font-medium">{value}</div>
                  </div>
                ) : null)}
              </div>
              {grn['Invoice_URL'] && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <a href={grn['Invoice_URL']} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 w-fit">
                    📄 View Invoice
                  </a>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Received Items</div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Total received: <span className="font-semibold text-gray-700">{totalReceived}</span></span>
                  {totalDefective > 0 && <span>Defective: <span className="font-semibold text-red-500">{totalDefective}</span></span>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400">
                      <th className="text-left pb-2">#</th>
                      <th className="text-left pb-2">Item</th>
                      <th className="text-right pb-2">Ordered</th>
                      <th className="text-right pb-2">Received</th>
                      <th className="text-right pb-2">Invoice Qty</th>
                      <th className="text-right pb-2">Defective</th>
                      <th className="text-left pb-2 pl-2">UOM</th>
                      <th className="text-left pb-2">Condition</th>
                      <th className="text-left pb-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items?.map((item: any) => (
                      <tr key={item.Line_No} className="border-b border-gray-50">
                        <td className="py-2.5 text-gray-400 text-xs">{item.Line_No}</td>
                        <td className="py-2.5 font-medium">{item.Item_Name}</td>
                        <td className="py-2.5 text-right text-gray-500">{item.Ordered_Qty || '—'}</td>
                        <td className="py-2.5 text-right font-medium text-green-600">{item.Received_Qty}</td>
                        <td className="py-2.5 text-right text-gray-500">{item.Invoice_Qty || item.Received_Qty}</td>
                        <td className={`py-2.5 text-right ${parseFloat(item.Defective_Qty) > 0 ? 'text-red-500 font-medium' : 'text-gray-300'}`}>
                          {parseFloat(item.Defective_Qty) > 0 ? item.Defective_Qty : '—'}
                        </td>
                        <td className="py-2.5 text-gray-500 pl-2 text-xs">{item.UOM}</td>
                        <td className={`py-2.5 text-xs font-medium ${CONDITION_COLOR[item.Condition] || 'text-gray-500'}`}>{item.Condition || '—'}</td>
                        <td className="py-2.5 text-xs text-gray-400">{item.Remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
            {/* Status */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Approval Status</div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${grn.Status !== 'Draft' ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'}`}>
                    {grn.Status !== 'Draft' ? '✓' : '1'}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-green-700">Storekeeper</div>
                    <div className="text-xs text-gray-400">{grn.Created_By_Name || 'Created'} · {grn.Created_At?.split(',')[0]}</div>
                  </div>
                </div>
                <div className="w-0.5 bg-gray-100 h-3 ml-3" />
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${grn.Status === 'Approved' ? 'bg-green-500 text-white' : grn.Status === 'Flagged' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {grn.Status === 'Approved' ? '✓' : grn.Status === 'Flagged' ? '!' : '2'}
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${grn.Status === 'Approved' ? 'text-green-700' : grn.Status === 'Flagged' ? 'text-red-600' : 'text-gray-400'}`}>
                      Site Person
                    </div>
                    <div className="text-xs text-gray-400">
                      {grn.Status === 'Approved'
                        ? `${grn.Approved_By || 'Approved'} · ${grn.Approved_At?.split(',')[0] || ''}`
                        : grn.Status === 'Flagged' ? `Flagged · ${grn.Flag_Reason || ''}`
                        : 'Awaiting approval'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice status */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Invoice</div>
              {grn['Invoice_URL'] ? (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <span>✓</span> Invoice uploaded
                </div>
              ) : (
                <div className="text-sm text-amber-600 font-medium">Invoice not uploaded</div>
              )}
              {grn['Invoice Number'] && (
                <div className="mt-2 text-xs text-gray-500">#{grn['Invoice Number']}</div>
              )}
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
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
