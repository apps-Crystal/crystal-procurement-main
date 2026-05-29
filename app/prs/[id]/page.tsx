'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const STATUS_BADGE: Record<string, string> = {
  DRAFT:        'bg-yellow-100 text-yellow-700',
  PR_SUBMITTED: 'bg-blue-100 text-blue-700',
  PR_APPROVED:  'bg-green-100 text-green-700',
  PR_REJECTED:  'bg-red-100 text-red-700',
  PO_POSTED:    'bg-purple-100 text-purple-700',
  CANCELLED:    'bg-gray-200 text-gray-700',
  ARCHIVED:     'bg-slate-200 text-slate-600',
};

function fmt(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n.replace(/[₹,]/g, '')) : n;
  if (!v || isNaN(v)) return '—';
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function PRDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [acting, setActing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    fetch(`/api/prs/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [id]);

  async function doAction(action: 'approve' | 'reject') {
    setActing(true);
    const res = await fetch(`/api/prs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, remarks }),
    });
    const result = await res.json();
    if (result.success) {
      setShowModal(false);
      const fresh = await fetch(`/api/prs/${id}`).then(r => r.json());
      setData(fresh);
    }
    setActing(false);
  }

  function startEdit() {
    const init: Record<string, string> = {};
    Object.entries(data?.pr || {}).forEach(([k, v]) => { init[k] = v == null ? '' : String(v); });
    setEditForm(init);
    setEditError('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditForm({});
    setEditError('');
  }

  async function saveEdit() {
    setSaving(true);
    setEditError('');
    try {
      const res = await fetch(`/api/prs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', updates: editForm }),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || `Save failed (${res.status})`);
      const fresh = await fetch(`/api/prs/${id}`).then(r => r.json());
      setData(fresh);
      setEditing(false);
      setEditForm({});
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data?.pr) return (
    <div className="flex-1 flex items-center justify-center text-gray-400">PR not found</div>
  );

  const { pr, items, vendor, pos } = data;
  const badgeCls = STATUS_BADGE[pr.Status_Code] || 'bg-gray-100 text-gray-600';
  const days = parseInt(pr.aging_days) || 0;
  const canApprove = pr.Status_Code === 'PR_SUBMITTED';
  const canCreatePO = pr.Status_Code === 'PR_APPROVED' && (!pos || pos.length === 0);

  const steps = [
    { label: 'PR Submitted', done: true, active: false, info: `${pr.Timestamp?.split(',')[0]} · ${pr.Requested_By}` },
    { label: 'PR Approved', done: ['PR_APPROVED', 'PO_POSTED'].includes(pr.Status_Code), active: pr.Status_Code === 'PR_SUBMITTED', info: pr.PR_Approved_By ? `${pr.PR_Approved_DateTime?.split(',')[0]} · ${pr.PR_Approved_By}` : days >= 3 ? `${days} days pending` : 'Awaiting approval' },
    { label: 'PO Created', done: pr.Status_Code === 'PO_POSTED', active: pr.Status_Code === 'PR_APPROVED', info: pos?.length > 0 ? pos[0].PO_ID : 'Pending' },
    { label: 'GRN Recorded', done: false, active: false, info: 'Pending delivery' },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* Approval modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full mx-4 shadow-2xl">
            <div className="font-semibold text-lg mb-1">Approve or Reject PR</div>
            <div className="text-sm text-gray-400 mb-4 font-mono">{pr.PR_ID}</div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Remarks</label>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-indigo-300"
              placeholder="Optional remarks for the requester..." />
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => doAction('reject')} disabled={acting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">Reject</button>
              <button onClick={() => doAction('approve')} disabled={acting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {acting ? 'Saving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 sticky top-0 z-10">
        <Link href="/prs" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-1">← Purchase Requests</Link>
      </div>

      <div className="px-4 py-4 md:px-7 md:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold font-mono">{pr.PR_ID}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeCls}`}>{pr.Status_Label || pr.Status_Code}</span>
              {days >= 3 && pr.Status_Code === 'PR_SUBMITTED' && (
                <span className={`text-xs font-semibold ${days >= 7 ? 'text-red-500' : 'text-amber-500'}`}>{days} days pending</span>
              )}
            </div>
            <div className="text-sm text-gray-500">{pr.Site} · {pr.Purchase_Category} · Raised by {pr.Requested_By}</div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={cancelEdit} disabled={saving}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={saveEdit} disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                {pr.Status_Code === 'PR_SUBMITTED' && (
                  <button onClick={startEdit}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                    Edit
                  </button>
                )}
                {canApprove && (
                  <button onClick={() => setShowModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
                    Approve / Reject
                  </button>
                )}
                {canCreatePO && (
                  <Link href={`/pos/new?pr=${encodeURIComponent(pr.PR_ID)}`}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
                    Create PO →
                  </Link>
                )}
                {pos?.length > 0 && (
                  <Link href={`/pos/${encodeURIComponent(pos[0].PO_ID)}`}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                    View PO →
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
        {editError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{editError}</div>
        )}

        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 min-w-0 space-y-4">
            {/* Details */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">PR Details</div>
              {(() => {
                // Fields shown elsewhere on the page (header, lifecycle, vendor card, items, remarks panel)
                const skip = new Set([
                  'PR_ID', 'Status_Code', 'Status_Label',
                  'Timestamp', 'Date_of_Requisition',
                  'Requested_By', 'aging_days',
                  'Last_Action_By', 'Last_Action_At',
                  'PR_Approved_By', 'PR_Approved_DateTime',
                  'Approver_Remarks',
                  'Upload Quotation', 'Final Agreed PI', 'Supporting Docs', 'PR_PDF_Link', 'Approval_Link', 'Approved_PR_Link',
                ]);
                // Columns not editable even in edit mode
                const readOnly = new Set([
                  'Total_Incl_GST', 'Vendor_ID',
                ]);
                const niceLabel = (k: string) => k.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
                // When editing, show every non-skipped column (including currently empty ones).
                // When viewing, only show non-empty ones.
                const source: Record<string, any> = editing ? editForm : pr;
                const entries = editing
                  ? Object.entries(source).filter(([k]) => !skip.has(k))
                  : Object.entries(source).filter(([k, v]) => !skip.has(k) && v !== '' && v !== null && v !== undefined && String(v).trim() !== '');
                const customRender: Record<string, (v: any) => any> = {
                  Vendor_ID: v => vendor?.Company_Name ? `${vendor.Company_Name} (${v})` : v,
                  Total_Incl_GST: v => fmt(v),
                };
                const customLabel: Record<string, string> = {
                  Vendor_ID: 'Vendor',
                  Purchase_Category: 'Category',
                  PR_Purpose: 'Purpose',
                  Is_Customer_Reimbursable: 'Reimbursable',
                  Expected_Delivery_Date: 'Expected Delivery',
                  Warranty_AMC: 'Warranty / AMC',
                  Total_Incl_GST: 'Total (incl. GST)',
                  Requisition_By: 'Requisitioned By',
                  Vendor_Ord_ref_no: 'Vendor Order Ref No',
                };
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                    {entries.map(([k, v]) => {
                      const label = customLabel[k] || niceLabel(k);
                      const value = customRender[k] ? customRender[k](v) : String(v);
                      const isLong = String(v || '').length > 60;
                      const InputTag: any = isLong ? 'textarea' : 'input';
                      return (
                        <div key={k}>
                          <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                          {editing && !readOnly.has(k) ? (
                            <InputTag
                              {...(isLong ? { rows: 2 } : {})}
                              value={editForm[k] ?? ''}
                              onChange={(e: any) => setEditForm(p => ({ ...p, [k]: e.target.value }))}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-full focus:outline-none focus:border-indigo-300 resize-none"
                            />
                          ) : (
                            <div className="font-medium break-words">{value}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {pr.Approver_Remarks && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-400 mb-1">Approver Remarks</div>
                  <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{pr.Approver_Remarks}</div>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Line Items</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400">
                    <th className="text-left pb-2 pr-2">#</th>
                    <th className="text-left pb-2 pr-4">Item</th>
                    <th className="text-left pb-2 pr-4">Purpose</th>
                    <th className="text-right pb-2 pr-3">Qty</th>
                    <th className="text-left pb-2 px-3">UOM</th>
                    <th className="text-right pb-2 pr-3">Rate</th>
                    <th className="text-right pb-2 pr-3">GST</th>
                    <th className="text-right pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items?.map((item: any) => (
                    <tr key={item.Line_No} className="border-b border-gray-50">
                      <td className="py-2.5 text-gray-400 pr-2">{item.Line_No}</td>
                      <td className="py-2.5 font-medium pr-4">{item.Item_Name}</td>
                      <td className="py-2.5 text-gray-500 text-xs pr-4">{item.Purpose}</td>
                      <td className="py-2.5 text-right pr-3">{item.Qty}</td>
                      <td className="py-2.5 text-gray-500 px-3">{item.UOM}</td>
                      <td className="py-2.5 text-right pr-3">{fmt(item.Rate)}</td>
                      <td className="py-2.5 text-right text-gray-500 pr-3">{item['GST_%']}%</td>
                      <td className="py-2.5 text-right font-medium">{fmt(item.Line_Total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={7} className="pt-3 text-right font-semibold text-sm pr-3">Grand Total (incl. GST)</td>
                    <td className="pt-3 text-right font-bold text-base">{fmt(pr.Total_Incl_GST)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Documents */}
            {(pr['Upload Quotation'] || pr['Final Agreed PI'] || pr['Supporting Docs']) && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Documents</div>
                <div className="flex flex-wrap gap-2">
                  {pr['Upload Quotation'] && <a href={pr['Upload Quotation']} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50">📄 Quotation</a>}
                  {pr['Final Agreed PI'] && <a href={pr['Final Agreed PI']} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50">📄 Final PI</a>}
                  {pr['Supporting Docs'] && <a href={pr['Supporting Docs']} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50">📎 Supporting Docs</a>}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
            {/* Lifecycle */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Lifecycle</div>
              <div className="space-y-1">
                {steps.map((step, i) => (
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

            {/* Vendor info */}
            {vendor && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Vendor</div>
                <div className="font-medium text-sm mb-2">{vendor.Company_Name}</div>
                <div className="space-y-1.5 text-xs text-gray-500">
                  {vendor.Contact_Person && <div>👤 {vendor.Contact_Person}</div>}
                  {vendor.Contact_Number && <div>📞 {vendor.Contact_Number}</div>}
                  {vendor.Email_ID && <div>✉️ {vendor.Email_ID}</div>}
                  {vendor.GST_Number && <div>GST: {vendor.GST_Number}</div>}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {['GST_Certificate_Link', 'PanCard_Link', 'Cancelled_Cheque_Link', 'MSME_Certificate_Link'].filter(k => vendor[k]).length === 4
                    ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">KYC Complete</span>
                    : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">KYC Incomplete</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
