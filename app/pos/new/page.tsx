'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

let _poItemId = 0;
function newPOItem(overrides = {}) { return { _id: ++_poItemId, name: '', qty: '', uom: '', rate: '', gst: '18', line_no: 1, ...overrides }; }

function NewPOInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prId = searchParams.get('pr');

  const [prData, setPRData] = useState<any>(null);
  const [loading, setLoading] = useState(!!prId);
  const [form, setForm] = useState({
    tally_no: '',
    po_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    delivery_terms: '',
    payment_terms: '',
    freight_amount: '',
    installation_amount: '',
    remarks: '',
  });
  const [items, setItems] = useState<any[]>([]);
  const [poPdfUrl, setPoPdfUrl] = useState('');
  const [poPdfId, setPoPdfId] = useState('');
  const [poPdfName, setPoPdfName] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function uploadPoPdf(file: File) {
    setUploadingPdf(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', '1jzqL2K4TB527pqoXD3xMsz9f3liAdQpk');
    // Temporary name; server renames to PO_{site}_{po_id} after creation.
    const site = prData?.pr?.Site || 'UNKNOWN';
    fd.append('prefix', `PO_DRAFT_${site}`);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Upload failed (${res.status})`);
      setPoPdfUrl(data.url);
      setPoPdfId(data.id);
      setPoPdfName(file.name);
    } catch (e: any) {
      setError(`PO PDF upload failed: ${e.message}`);
      setPoPdfUrl('');
      setPoPdfId('');
      setPoPdfName('');
    } finally {
      setUploadingPdf(false);
    }
  }

  useEffect(() => {
    if (!prId) return;
    fetch(`/api/prs/${encodeURIComponent(prId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.pr) {
          setPRData(d);
          setForm(p => ({
            ...p,
            delivery_terms: d.pr.Delivery_Terms || '',
            payment_terms: d.pr.Payment_Terms || '',
            expected_delivery_date: d.pr.Expected_Delivery_Date || '',
          }));
          setItems((d.items || []).map((it: any) => newPOItem({
            name: it.Item_Name,
            qty: it.Qty,
            uom: it.UOM,
            rate: it.Rate || '',
            gst: it['GST_%'] || '18',
            line_no: it.Line_No,
          })));
        }
        setLoading(false);
      });
  }, [prId]);

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function setItem(idx: number, field: string, value: string) {
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function addItem() {
    setItems(p => [...p, newPOItem({ line_no: p.length + 1 })]);
  }

  function removeItem(idx: number) {
    setItems(p => p.filter((_, i) => i !== idx));
  }

  function lineTotal(item: any) {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    const gst = parseFloat(item.gst) || 0;
    return qty * rate * (1 + gst / 100);
  }

  const grandTotal = items.reduce((s, it) => s + lineTotal(it), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prData?.pr && !prId) { setError('No PR linked'); return; }
    if (!form.po_date) { setError('PO date is required'); return; }
    const validItems = items.filter(it => it.name.trim() && parseFloat(it.qty) > 0);
    if (validItems.length === 0) { setError('At least one item with qty is required'); return; }
    if (uploadingPdf) { setError('Please wait for the PO PDF upload to finish'); return; }
    setSaving(true);
    setError('');

    const res = await fetch('/api/pos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pr_id: prData?.pr?.PR_ID || prId,
        site: prData?.pr?.Site,
        vendor_id: prData?.pr?.Vendor_ID || prData?.vendor?.Vendor_ID,
        vendor_name: prData?.vendor?.Company_Name || prData?.pr?.Vendor_ID,
        tally_no: form.tally_no,
        po_date: form.po_date,
        payment_terms: form.payment_terms,
        delivery_terms: form.delivery_terms,
        expected_delivery_date: form.expected_delivery_date,
        remarks: form.remarks,
        freight_amount: form.freight_amount ? parseFloat(form.freight_amount) : null,
        installation_amount: form.installation_amount ? parseFloat(form.installation_amount) : null,
        items: validItems.map((it, i) => ({
          name: it.name,
          qty: it.qty,
          uom: it.uom,
          rate: it.rate,
          gst: it.gst,
          line_no: i + 1,
        })),
        created_by: 'Yatish Agarwal',
        po_pdf_url: poPdfUrl,
        po_pdf_file_id: poPdfId,
      }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); setSaving(false); return; }
    router.push(`/pos/${encodeURIComponent(data.po_id)}`);
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const pr = prData?.pr;
  const vendor = prData?.vendor;

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 flex items-center justify-between sticky top-0 z-10">
        <Link href={pr ? `/prs/${encodeURIComponent(pr.PR_ID)}` : '/pos'} className="text-sm text-gray-400 hover:text-gray-600">
          ← {pr ? `PR ${pr.PR_ID}` : 'Purchase Orders'}
        </Link>
        <div className="font-semibold text-gray-800">Create Purchase Order</div>
        <div />
      </div>

      <form onSubmit={submit} className="px-4 py-4 md:px-7 md:py-6 space-y-4 max-w-5xl">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

        {/* PR Summary */}
        {pr && (
          <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 flex items-start justify-between">
            <div>
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">From PR</div>
              <div className="font-semibold text-indigo-800 font-mono">{pr.PR_ID}</div>
              <div className="text-sm text-indigo-600 mt-0.5">{pr.Site} · {pr.Purchase_Category} · {vendor?.Company_Name || pr.Vendor_ID || 'No vendor assigned'}</div>
              {pr.PR_Purpose && <div className="text-xs text-indigo-500 mt-1">{pr.PR_Purpose}</div>}
            </div>
            <div className="text-right">
              <div className="text-xs text-indigo-400">PR Value</div>
              <div className="font-bold text-indigo-800">
                {pr.Total_Incl_GST ? `₹${parseFloat(String(pr.Total_Incl_GST).replace(/[₹,]/g,'')).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
              </div>
            </div>
          </div>
        )}

        <Section title="PO Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">PO Date <span className="text-red-400">*</span></label>
              <input type="date" value={form.po_date} onChange={e => set('po_date', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tally PO No.</label>
              <input value={form.tally_no} onChange={e => set('tally_no', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="From Tally system..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Expected Delivery Date</label>
              <input type="date" value={form.expected_delivery_date} onChange={e => set('expected_delivery_date', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Payment Terms</label>
              <input value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="Advance: 30% | Post Delivery: 70%..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Delivery Terms</label>
              <input value={form.delivery_terms} onChange={e => set('delivery_terms', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="FOR Destination / Ex-Works..." />
            </div>
            <div />
            <div>
              <label className="block text-xs text-gray-500 mb-1">Freight Amount (if any)</label>
              <input type="number" min="0" value={form.freight_amount} onChange={e => set('freight_amount', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Installation Amount (if any)</label>
              <input type="number" min="0" value={form.installation_amount} onChange={e => set('installation_amount', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                placeholder="0" />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Remarks</label>
              <textarea value={form.remarks} onChange={e => set('remarks', e.target.value)} rows={2}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300 resize-none"
                placeholder="Additional instructions or notes..." />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">PO PDF</label>
              {!poPdfUrl && !uploadingPdf && (
                <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-pointer hover:border-indigo-300 hover:text-indigo-600 max-w-sm">
                  <span>Choose PO PDF...</span>
                  <input type="file" accept=".pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPoPdf(f); }} />
                </label>
              )}
              {uploadingPdf && (
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 max-w-sm">
                  <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span>Uploading...</span>
                </div>
              )}
              {poPdfUrl && !uploadingPdf && (
                <div className="flex items-center justify-between gap-2 border border-green-200 bg-green-50 rounded-lg px-3 py-2 text-sm max-w-sm">
                  <a href={poPdfUrl} target="_blank" rel="noreferrer" className="text-green-700 hover:underline truncate">
                    ✓ {poPdfName || 'PO PDF uploaded'}
                  </a>
                  <button type="button" onClick={() => { setPoPdfUrl(''); setPoPdfId(''); setPoPdfName(''); }}
                    className="text-xs text-gray-400 hover:text-red-500">✕</button>
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Line Items">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2 min-w-48">Item</th>
                  <th className="text-right pb-2">Qty</th>
                  <th className="text-left pb-2 pl-2">UOM</th>
                  <th className="text-right pb-2 min-w-28">Rate (₹)</th>
                  <th className="text-right pb-2">GST %</th>
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
                        <input value={item.name} onChange={e => setItem(idx, 'name', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-indigo-300" />
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min="0" value={item.qty} onChange={e => setItem(idx, 'qty', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-20 text-right focus:outline-none focus:border-indigo-300" />
                      </td>
                      <td className="py-2 pr-2 pl-2">
                        <input value={item.uom} onChange={e => setItem(idx, 'uom', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:border-indigo-300" />
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
                      <td className="py-2 text-right font-medium pr-2">
                        {total > 0 ? `₹${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                      </td>
                      <td className="py-2">
                        <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} className="pt-3">
                    <button type="button" onClick={addItem} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">+ Add Item</button>
                  </td>
                </tr>
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={6} className="pt-3 text-right font-semibold text-sm">Grand Total (incl. GST)</td>
                  <td className="pt-3 text-right font-bold text-base pr-2">
                    {grandTotal > 0 ? `₹${grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td />
                </tr>
                {form.freight_amount && (
                  <tr>
                    <td colSpan={6} className="pt-1 text-right text-xs text-gray-500">+ Freight</td>
                    <td className="pt-1 text-right text-xs text-gray-500 pr-2">₹{parseFloat(form.freight_amount).toLocaleString('en-IN')}</td>
                    <td />
                  </tr>
                )}
                {form.installation_amount && (
                  <tr>
                    <td colSpan={6} className="pt-1 text-right text-xs text-gray-500">+ Installation</td>
                    <td className="pt-1 text-right text-xs text-gray-500 pr-2">₹{parseFloat(form.installation_amount).toLocaleString('en-IN')}</td>
                    <td />
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </Section>

        <div className="flex justify-end gap-3 pb-6">
          <Link href={pr ? `/prs/${encodeURIComponent(pr.PR_ID)}` : '/pos'}
            className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Creating PO...' : 'Create Purchase Order'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{title}</div>
      {children}
    </div>
  );
}

export default function NewPO() {
  return <Suspense><NewPOInner /></Suspense>;
}
