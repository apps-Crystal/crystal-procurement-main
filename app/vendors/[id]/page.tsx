'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

function fmt(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n.replace(/[₹,]/g, '')) : n;
  if (!v || isNaN(v)) return '—';
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const KYC_DOCS = [
  { key: 'GST_Certificate_Link', label: 'GST Certificate',
    folder: '1wCpfXHOsMLKJRwKK6G2UHiEptWBfYO1d', namePrefix: 'GST' },
  { key: 'PanCard_Link',         label: 'PAN Card',
    folder: '1uwSKKG7HwO54sFuUhcWhkl9Jc6bwBGM1', namePrefix: 'PAN' },
  { key: 'Cancelled_Cheque_Link',label: 'Cancelled Cheque',
    folder: '1_wLU_ysRR9leStWixn9ThWrS8t6uHaRq', namePrefix: 'CHEQUE' },
  { key: 'MSME_Certificate_Link',label: 'MSME Certificate',
    folder: '1LgU60dPaXXaZ0heBlb0QY-d-TIkasFYQ', namePrefix: 'MSME' },
];

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [uploadingKyc, setUploadingKyc] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState('');

  async function uploadKyc(docKey: string, folder: string, namePrefix: string, file: File) {
    const vendorId = form.Vendor_ID || data?.vendor?.Vendor_ID || id;
    setUploadingKyc(p => ({ ...p, [docKey]: true }));
    setUploadError('');
    try {
      const ext = file.name.lastIndexOf('.') > -1 ? file.name.slice(file.name.lastIndexOf('.')) : '';
      const filename = `${vendorId}_${namePrefix}_1${ext}`;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', folder);
      fd.append('filename', filename);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Upload failed (${res.status})`);
      setForm((p: any) => ({ ...p, [docKey]: data.url }));
    } catch (e: any) {
      setUploadError(`${namePrefix} upload failed: ${e.message}`);
    } finally {
      setUploadingKyc(p => ({ ...p, [docKey]: false }));
    }
  }

  useEffect(() => {
    fetch(`/api/vendors/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => { setData(d); setForm(d.vendor || {}); setLoading(false); });
  }, [id]);

  async function save() {
    if (Object.values(uploadingKyc).some(Boolean)) {
      setUploadError('Please wait for KYC uploads to finish');
      return;
    }
    setSaving(true);
    await fetch(`/api/vendors/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const fresh = await fetch(`/api/vendors/${encodeURIComponent(id)}`).then(r => r.json());
    setData(fresh);
    setForm(fresh.vendor || {});
    setEditing(false);
    setSaving(false);
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data?.vendor) return (
    <div className="flex-1 flex items-center justify-center text-gray-400">Vendor not found</div>
  );

  const { vendor, recentPos, recentGrns, stats } = data;
  const kycComplete = vendor.kyc_status === 'complete';

  function Field({ label, field, type = 'text' }: { label: string; field: string; type?: string }) {
    return (
      <div>
        <div className="text-xs text-gray-400 mb-0.5">{label}</div>
        {editing ? (
          <input type={type} value={form[field] || ''} onChange={e => setForm((p: any) => ({ ...p, [field]: e.target.value }))}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm w-full focus:outline-none focus:border-indigo-300" />
        ) : (
          <div className="font-medium text-sm">{vendor[field] || '—'}</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-7 py-3.5 sticky top-0 z-10">
        <Link href="/vendors" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-1">← Vendors</Link>
      </div>

      <div className="px-7 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold">{vendor.Company_Name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${kycComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {vendor.kyc_label}
              </span>
              <span className={`text-xs font-medium ${vendor.Active === 'Yes' ? 'text-green-600' : 'text-gray-400'}`}>
                {vendor.Active === 'Yes' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-sm text-gray-500 font-mono">{vendor.Vendor_ID}</div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setForm(vendor); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Company Information</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Company Name" field="Company_Name" />
                <Field label="Contact Person" field="Contact_Person" />
                <Field label="Phone" field="Contact_Number" />
                <Field label="Email" field="Email_ID" type="email" />
                <Field label="GST Number" field="GST_Number" />
                <Field label="PAN" field="Vendor_PAN" />
                <Field label="MSME No." field="MSME_No" />
                <Field label="Sites Serving" field="Providing_Sites" />
              </div>
              {editing && (
                <div className="mt-3">
                  <div className="text-xs text-gray-400 mb-0.5">Address</div>
                  <textarea value={form.Address || ''} onChange={e => setForm((p: any) => ({ ...p, Address: e.target.value }))} rows={2}
                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm w-full focus:outline-none focus:border-indigo-300 resize-none" />
                </div>
              )}
              {!editing && vendor.Address && (
                <div className="mt-3">
                  <div className="text-xs text-gray-400 mb-0.5">Address</div>
                  <div className="text-sm text-gray-600">{vendor.Address}</div>
                </div>
              )}
            </div>

            {/* Bank Details */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Bank Details</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Bank Name" field="Bank_Name" />
                <Field label="Account Holder" field="Account_Holder_Name" />
                <Field label="Account Number" field="Account_Number" />
                <Field label="Branch" field="Branch_Name" />
                <Field label="IFSC Code" field="IFSC_Code" />
              </div>
            </div>
          </div>

          {/* KYC + Stats */}
          <div className="space-y-4">
            {/* KYC Documents */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">KYC Documents</div>
              {uploadError && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{uploadError}</div>
              )}
              <div className="space-y-3">
                {KYC_DOCS.map(doc => {
                  const currentUrl = editing ? (form[doc.key] || '') : (vendor[doc.key] || '');
                  const isUploading = uploadingKyc[doc.key];
                  return (
                    <div key={doc.key} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                        ${currentUrl ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {currentUrl ? '✓' : '—'}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">{doc.label}</div>
                      </div>
                      {editing ? (
                        <div className="flex items-center gap-2">
                          {isUploading ? (
                            <div className="flex items-center gap-2 border border-gray-200 rounded px-2 py-1 text-xs text-gray-500">
                              <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                              <span>Uploading...</span>
                            </div>
                          ) : (
                            <label className="border border-dashed border-gray-300 rounded px-2 py-1 text-xs text-gray-500 cursor-pointer hover:border-indigo-300 hover:text-indigo-600 whitespace-nowrap">
                              {currentUrl ? 'Replace' : 'Choose file'}
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) { uploadKyc(doc.key, doc.folder, doc.namePrefix, f); e.target.value = ''; } }} />
                            </label>
                          )}
                          <input value={form[doc.key] || ''} onChange={e => setForm((p: any) => ({ ...p, [doc.key]: e.target.value }))}
                            placeholder="or paste link..."
                            className="border border-gray-200 rounded px-2 py-1 text-xs w-40 focus:outline-none focus:border-indigo-300" />
                          {currentUrl && (
                            <a href={currentUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline whitespace-nowrap">View</a>
                          )}
                        </div>
                      ) : currentUrl ? (
                        <a href={currentUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View →</a>
                      ) : (
                        <span className="text-xs text-gray-400">Not uploaded</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Activity</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">{stats.totalPOs}</div>
                  <div className="text-xs text-gray-500 mt-1">Purchase Orders</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl font-bold text-gray-800">{fmt(stats.totalValue)}</div>
                  <div className="text-xs text-gray-500 mt-1">Total PO Value</div>
                </div>
              </div>
            </div>

            {/* Recent POs */}
            {recentPos.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recent POs</div>
                <div className="space-y-2">
                  {recentPos.slice(0, 5).map((po: any) => (
                    <Link key={po.PO_ID} href={`/pos/${encodeURIComponent(po.PO_ID)}`}
                      className="flex items-center justify-between py-1.5 hover:bg-gray-50 rounded px-1 -mx-1 group">
                      <div>
                        <div className="text-xs font-mono text-indigo-600 group-hover:underline">{po.PO_ID}</div>
                        <div className="text-xs text-gray-400">{po.Site} · {po.PO_Date}</div>
                      </div>
                      <div className="text-xs font-medium">{fmt(po.Total_Incl_GST)}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
