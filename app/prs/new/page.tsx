'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SITES = ['Noida', 'Detroj', 'Pune', 'Kheda', 'Kolkata', 'Bhubaneswar', 'Dhulagarh', 'Dankuni', 'Mumbai', 'Vavdi', 'Taloja'];
const CATEGORIES = ['Maintenance Capex', 'Operations Capex', 'Project/Site Capex', 'Service', 'Consumables', 'Assets'];
const PROC_TYPES = ['Material', 'Service'];
const DELIVERY_CHARGES = ['Included', 'Chargeable', 'Extra at Actuals'];

let _itemId = 0;
function newItem() { return { _id: ++_itemId, item_name: '', purpose: '', qty: '', uom: '', rate: '', gst: '18', delivery: '' }; }
const EMPTY_ITEM = { item_name: '', purpose: '', qty: '', uom: '', rate: '', gst: '18', delivery: '' };


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{title}</div>
      {children}
    </div>
  );
}
export default function NewPR() {
  const router = useRouter();

  const [form, setForm] = useState({
    site: '',
    category: '',
    procurement_type: 'Material',
    vendor_id: '',
    vendor_order_ref_no: '',
    remarks: '',
    pr_purpose: '',
    payment_adv: '', payment_before: '', payment_running: '', payment_postdel: '', payment_postcomp: '', payment_retention: '',
    specific_payment_terms: '',
    delivery_terms: '',
    delivery_location: '',
    delivery_charges: '',
    expected_delivery_date: '',
    is_reimbursable: 'No',
    warranty_amc: '',
    quality_terms: '',
    special_terms: '',
    other_terms: '',
  });
  const [items, setItems] = useState([newItem()]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorResults, setVendorResults] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [quotationUrl, setQuotationUrl] = useState('');
  const [quotationName, setQuotationName] = useState('');
  const [uploadingQuotation, setUploadingQuotation] = useState(false);
  const [piUrl, setPiUrl] = useState('');
  const [piName, setPiName] = useState('');
  const [uploadingPi, setUploadingPi] = useState(false);
  const [supportingUrl, setSupportingUrl] = useState('');
  const [supportingName, setSupportingName] = useState('');
  const [uploadingSupporting, setUploadingSupporting] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function uploadDoc(file: File, prefix: string,
    setUrl: (u: string) => void, setName: (n: string) => void, setBusy: (b: boolean) => void) {
    setBusy(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('prefix', prefix);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Upload failed (${res.status})`);
      setUrl(data.url);
      setName(file.name);
    } catch (e: any) {
      setError(`Upload failed: ${e.message}`);
      setUrl('');
      setName('');
    } finally {
      setBusy(false);
    }
  }

  // Vendor search debounce
  useEffect(() => {
    if (!vendorSearch || vendorSearch.length < 2) { setVendorResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/vendors?search=${encodeURIComponent(vendorSearch)}`)
        .then(r => r.json())
        .then(d => setVendorResults((d.vendors || []).slice(0, 8)));
    }, 300);
    return () => clearTimeout(t);
  }, [vendorSearch]);

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function setItem(idx: number, field: string, value: string) {
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function addItem() { setItems(p => [...p, newItem()]); }
  function removeItem(idx: number) { setItems(p => p.filter((_, i) => i !== idx)); }

  function lineTotal(item: typeof EMPTY_ITEM) {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    const gst = parseFloat(item.gst) || 0;
    const delivery = parseFloat(item.delivery) || 0;
    return qty * rate * (1 + gst / 100) + delivery;
  }

  const grandTotal = items.reduce((s, it) => s + lineTotal(it), 0);

  function paymentSummary() {
    const parts = [
      form.payment_adv ? `Advance: ${form.payment_adv}%` : null,
      form.payment_before ? `Before Delivery: ${form.payment_before}%` : null,
      form.payment_running ? `Running: ${form.payment_running}%` : null,
      form.payment_postdel ? `Post Delivery: ${form.payment_postdel}%` : null,
      form.payment_postcomp ? `Post Completion: ${form.payment_postcomp}%` : null,
      form.payment_retention ? `Retention: ${form.payment_retention}%` : null,
    ].filter(Boolean);
    return parts.join(' | ');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.site) { setError('Please select a site'); return; }
    if (!form.category) { setError('Please select a category'); return; }
    if (!items[0].item_name) { setError('At least one item is required'); return; }
    if (uploadingQuotation || uploadingPi || uploadingSupporting) { setError('Please wait for file uploads to finish'); return; }
    setSaving(true);
    setError('');

    let res: Response;
    try {
      res = await fetch('/api/prs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        site: form.site,
        category: form.category,
        procurement_type: form.procurement_type,
        vendor_id: form.vendor_id,
        purpose: form.pr_purpose,
        payment_stages: {
          Advance: form.payment_adv,
          'Before Delivery': form.payment_before,
          Running: form.payment_running,
          'Post Delivery': form.payment_postdel,
          'Post Completion': form.payment_postcomp,
          Retention: form.payment_retention,
        },
        specific_payment_terms: form.specific_payment_terms,
        delivery_terms: form.delivery_terms,
        delivery_location: form.delivery_location,
        delivery_charges: form.delivery_charges,
        expected_delivery: form.expected_delivery_date,
        is_reimbursable: form.is_reimbursable,
        warranty_amc: form.warranty_amc,
        quality_terms: form.quality_terms,
        special_terms: form.special_terms,
        other_terms: form.other_terms,
        vendor_order_ref_no: form.vendor_order_ref_no,
        remarks: form.remarks,
        upload_quotation: quotationUrl,
        final_agreed_pi: piUrl,
        supporting_docs: supportingUrl,
        items: items.filter(it => it.item_name.trim()).map((it, i) => ({
          line_no: i + 1,
          name: it.item_name,
          purpose: it.purpose,
          qty: it.qty,
          uom: it.uom,
          rate: it.rate,
          gst: it.gst,
          delivery: it.delivery,
          line_total: lineTotal(it).toFixed(2),
          })),
        }),
      });
    } catch (networkErr: any) {
      setError(`Network error: ${networkErr.message || 'Could not reach server'}`);
      setSaving(false);
      return;
    }
    let data: any;
    try {
      data = await res.json();
    } catch {
      setError(`Server returned ${res.status} with non-JSON response`);
      setSaving(false);
      return;
    }
    if (!res.ok || data.error) {
      setError(data.error || `Server error (${res.status})`);
      setSaving(false);
      return;
    }
    if (!data.pr_id) {
      setError('Server did not return a PR ID');
      setSaving(false);
      return;
    }
    router.push(`/prs/${encodeURIComponent(data.pr_id)}`);
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 flex items-center justify-between sticky top-0 z-10">
        <Link href="/prs" className="text-sm text-gray-400 hover:text-gray-600">← Purchase Requests</Link>
        <div className="font-semibold text-gray-800">New Purchase Request</div>
        <div />
      </div>

      <form onSubmit={submit} className="px-4 py-4 md:px-7 md:py-6 space-y-4 max-w-5xl">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

        <Section title="Request Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Site <span className="text-red-400">*</span></label>
              <select value={form.site} onChange={e => set('site', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300">
                <option value="">Select site...</option>
                {SITES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category <span className="text-red-400">*</span></label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300">
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Procurement Type</label>
              <select value={form.procurement_type} onChange={e => set('procurement_type', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300">
                {PROC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Purpose / Description</label>
              <textarea value={form.pr_purpose} onChange={e => set('pr_purpose', e.target.value)} rows={2}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300 resize-none"
                placeholder="Brief description of what is needed and why..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Customer Reimbursable?</label>
              <select value={form.is_reimbursable} onChange={e => set('is_reimbursable', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300">
                <option>No</option>
                <option>Yes</option>
              </select>
            </div>
          </div>
        </Section>

        {/* Delivery */}
        <Section title="Delivery">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Expected Delivery Date</label>
              <input type="date" value={form.expected_delivery_date} onChange={e => set('expected_delivery_date', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Delivery Location</label>
              <select value={form.delivery_location} onChange={e => set('delivery_location', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300">
                <option value="">Select delivery location...</option>
                {SITES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Delivery Charges</label>
              <select value={form.delivery_charges} onChange={e => set('delivery_charges', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300">
                <option value="">Select delivery charges...</option>
                {DELIVERY_CHARGES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Special Delivery Terms</label>
              <input value={form.delivery_terms} onChange={e => set('delivery_terms', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="FOR Destination / Ex-Works / specific handling..." />
            </div>
          </div>
        </Section>

        {/* Warranty */}
        <Section title="Warranty">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Warranty / AMC</label>
              <input value={form.warranty_amc} onChange={e => set('warranty_amc', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="1 year / 2 year AMC..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Special Terms</label>
              <input value={form.special_terms} onChange={e => set('special_terms', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="Any special conditions..." />
            </div>
          </div>
        </Section>

        {/* Quality */}
        <Section title="Quality">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Quality Terms</label>
              <input value={form.quality_terms} onChange={e => set('quality_terms', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="ISI / OEM / inspection..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Other Terms</label>
              <input value={form.other_terms} onChange={e => set('other_terms', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="Anything else..." />
            </div>
          </div>
        </Section>

        {/* Vendor & Documents */}
        <Section title="Vendor & Documents (Optional — can assign later)">
          <div className="relative mb-4">
            <label className="block text-xs text-gray-500 mb-1">Vendor</label>
            <input value={selectedVendor ? `${selectedVendor.Company_Name} (${selectedVendor.Vendor_ID})` : vendorSearch}
              onChange={e => { setVendorSearch(e.target.value); setSelectedVendor(null); set('vendor_id', ''); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:border-indigo-300"
              placeholder="Search vendor by name, GST, ID..." />
            {vendorResults.length > 0 && !selectedVendor && (
              <div className="absolute top-full left-0 mt-1 w-96 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                {vendorResults.map(v => (
                  <button type="button" key={v.Vendor_ID} onClick={() => { setSelectedVendor(v); set('vendor_id', v.Vendor_ID); setVendorSearch(''); setVendorResults([]); }}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left">
                    <div>
                      <div className="text-sm font-medium">{v.Company_Name}</div>
                      <div className="text-xs text-gray-400">{v.Vendor_ID} · {v.GST_Number || 'No GST'}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${v.kyc_status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{v.kyc_label}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedVendor && (
              <button type="button" onClick={() => { setSelectedVendor(null); set('vendor_id', ''); }}
                className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕ Clear</button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vendor Order Ref No</label>
              <input value={form.vendor_order_ref_no} onChange={e => set('vendor_order_ref_no', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="Vendor's reference / quote no..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Remarks</label>
              <input value={form.remarks} onChange={e => set('remarks', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="Additional notes..." />
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Documents</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Upload Quotation',
                url: quotationUrl,
                name: quotationName,
                busy: uploadingQuotation,
                onPick: (f: File) => uploadDoc(f, 'QUOTATION', setQuotationUrl, setQuotationName, setUploadingQuotation),
                clear: () => { setQuotationUrl(''); setQuotationName(''); },
              },
              {
                label: 'Final Agreed PI',
                url: piUrl,
                name: piName,
                busy: uploadingPi,
                onPick: (f: File) => uploadDoc(f, 'FINAL_PI', setPiUrl, setPiName, setUploadingPi),
                clear: () => { setPiUrl(''); setPiName(''); },
              },
              {
                label: 'Supporting Documents',
                url: supportingUrl,
                name: supportingName,
                busy: uploadingSupporting,
                onPick: (f: File) => uploadDoc(f, 'SUPPORTING', setSupportingUrl, setSupportingName, setUploadingSupporting),
                clear: () => { setSupportingUrl(''); setSupportingName(''); },
              },
            ].map(d => (
              <div key={d.label}>
                <label className="block text-xs text-gray-500 mb-1">{d.label}</label>
                {!d.url && !d.busy && (
                  <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-pointer hover:border-indigo-300 hover:text-indigo-600">
                    <span>Choose file...</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) d.onPick(f); }} />
                  </label>
                )}
                {d.busy && (
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span>Uploading...</span>
                  </div>
                )}
                {d.url && !d.busy && (
                  <div className="flex items-center justify-between gap-2 border border-green-200 bg-green-50 rounded-lg px-3 py-2 text-sm">
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-green-700 hover:underline truncate">
                      ✓ {d.name || 'Uploaded'}
                    </a>
                    <button type="button" onClick={d.clear} className="text-xs text-gray-400 hover:text-red-500">✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Payment Terms */}
        <Section title="Payment Terms">
          <div className="text-xs text-gray-500 mb-3">Enter percentages for each stage (total should be 100%)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              ['Advance', 'payment_adv'],
              ['Before Delivery', 'payment_before'],
              ['Running', 'payment_running'],
              ['Post Delivery', 'payment_postdel'],
              ['Post Completion', 'payment_postcomp'],
              ['Retention', 'payment_retention'],
            ].map(([label, field]) => (
              <div key={field}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <div className="relative">
                  <input type="number" min="0" max="100" value={(form as any)[field] || ''} onChange={e => set(field, e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300 pr-6"
                    placeholder="0" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                </div>
              </div>
            ))}
          </div>
          {paymentSummary() && (
            <div className="mt-2 text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">{paymentSummary()}</div>
          )}
          <div className="mt-4">
            <label className="block text-xs text-gray-500 mb-1">Specific Payment Terms</label>
            <textarea value={form.specific_payment_terms} onChange={e => set('specific_payment_terms', e.target.value)} rows={2}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300 resize-none"
              placeholder="Net 30 days from invoice / payment against delivery / any specific clauses..." />
          </div>
        </Section>

        {/* Line Items */}
        <Section title="Line Items">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2 min-w-48">Item Name <span className="text-red-400">*</span></th>
                  <th className="text-left pb-2 min-w-32">Purpose</th>
                  <th className="text-right pb-2">Qty</th>
                  <th className="text-left pb-2 pl-2 min-w-20">UOM</th>
                  <th className="text-right pb-2 min-w-28">Rate (₹)</th>
                  <th className="text-right pb-2">GST %</th>
                  {form.delivery_charges === 'Chargeable' && (
                    <th className="text-right pb-2 min-w-28">Delivery (₹)</th>
                  )}
                  <th className="text-right pb-2 min-w-28">Total</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const total = lineTotal(item);
                  return (
                    <tr key={item._id} className="border-b border-gray-50">
                      <td className="py-2 text-gray-400 text-xs pr-2">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <input value={item.item_name} onChange={e => setItem(idx, 'item_name', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-indigo-300"
                          placeholder="Item description..." />
                      </td>
                      <td className="py-2 pr-2">
                        <input value={item.purpose} onChange={e => setItem(idx, 'purpose', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-indigo-300"
                          placeholder="For..." />
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min="0" value={item.qty} onChange={e => setItem(idx, 'qty', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-20 text-right focus:outline-none focus:border-indigo-300" />
                      </td>
                      <td className="py-2 pr-2 pl-2">
                        <input value={item.uom} onChange={e => setItem(idx, 'uom', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:border-indigo-300"
                          placeholder="Nos/Kg/m..." />
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min="0" value={item.rate} onChange={e => setItem(idx, 'rate', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-32 text-right focus:outline-none focus:border-indigo-300" />
                      </td>
                      <td className="py-2 pr-2">
                        <select value={item.gst} onChange={e => setItem(idx, 'gst', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:border-indigo-300">
                          {['0', '5', '12', '18', '28'].map(g => <option key={g}>{g}</option>)}
                        </select>
                      </td>
                      {form.delivery_charges === 'Chargeable' && (
                        <td className="py-2 pr-2">
                          <input type="number" min="0" value={item.delivery} onChange={e => setItem(idx, 'delivery', e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-sm w-28 text-right focus:outline-none focus:border-indigo-300"
                            placeholder="0" />
                        </td>
                      )}
                      <td className="py-2 text-right font-medium text-sm pr-2">
                        {total > 0 ? `₹${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                      </td>
                      <td className="py-2">
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={form.delivery_charges === 'Chargeable' ? 10 : 9} className="pt-3">
                    <button type="button" onClick={addItem}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">+ Add Item</button>
                  </td>
                </tr>
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={form.delivery_charges === 'Chargeable' ? 8 : 7} className="pt-3 text-right font-semibold text-sm">Grand Total (incl. GST + Delivery)</td>
                  <td className="pt-3 text-right font-bold text-base pr-2">
                    {grandTotal > 0 ? `₹${grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>

        <div className="flex justify-end gap-3 pb-6">
          <Link href="/prs" className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Submitting...' : 'Submit PR'}
          </button>
        </div>
      </form>
    </div>
  );
}
