'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const CONDITIONS = ['Good', 'Partial', 'Damaged'];
let _grnItemId = 0;

function NewGRNInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefilledPO = searchParams.get('po');

  const [poSearch, setPoSearch] = useState(prefilledPO || '');
  const [poResults, setPoResults] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [poData, setPOData] = useState<any>(null);
  const [loadingPO, setLoadingPO] = useState(false);
  const [form, setForm] = useState({
    invoice_number: '',
    invoice_value: '',
    invoice_date: new Date().toISOString().split('T')[0],
    lr_number: '',
    vehicle_number: '',
  });
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-load PO if prefilled
  useEffect(() => {
    if (prefilledPO) loadPO(prefilledPO);
  }, []);

  // PO search (manual search for non-prefilled)
  useEffect(() => {
    if (prefilledPO || !poSearch || poSearch.length < 2) { setPoResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/pos?status=all`)
        .then(r => r.json())
        .then(d => {
          const q = poSearch.toLowerCase();
          const matches = (d.pos || [])
            .filter((p: any) => {
              // Try all possible vendor field names in case of schema variation
              const vendorName = (p.Vendor_Company_Name || p.Vendor_Name || p.Vendor_ID || '').toLowerCase();
              return p.PO_ID?.toLowerCase().includes(q) ||
                vendorName.includes(q) ||
                p.Site?.toLowerCase().includes(q);
            })
            .slice(0, 8);
          setPoResults(matches);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [poSearch]);

  async function loadPO(poId: string) {
    setLoadingPO(true);
    const d = await fetch(`/api/pos/${encodeURIComponent(poId)}`).then(r => r.json());
    if (d.po) {
      setPOData(d);
      setSelectedPO(d.po);
      // Pre-fill items from PO items (with delivered qty as context)
      setItems((d.items || []).map((it: any) => ({
        _id: ++_grnItemId,
        item_name: it.Item_Name,
        ordered_qty: it.Qty,
        received_qty: it.balance > 0 ? it.balance : it.Qty,
        invoice_qty: '',
        defective_qty: '0',
        uom: it.UOM,
        condition: 'Good',
        remarks: '',
      })));
    }
    setLoadingPO(false);
    setPoResults([]);
  }

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function setItem(idx: number, field: string, value: string) {
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPO) { setError('Please select a PO'); return; }
    if (!form.invoice_number.trim()) { setError('Invoice number is required'); return; }
    if (!form.invoice_value) { setError('Invoice value is required'); return; }
    const validItems = items.filter(it => parseFloat(it.received_qty) > 0);
    if (validItems.length === 0) { setError('At least one item with received quantity is required'); return; }

    setSaving(true);
    setError('');

    const res = await fetch('/api/grns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        po_id: selectedPO.PO_ID,
        site: selectedPO.Site,
        vendor_id: selectedPO.Vendor_ID,
        invoice_number: form.invoice_number,
        invoice_value: form.invoice_value,
        invoice_date: form.invoice_date,
        lr_number: form.lr_number,
        vehicle_number: form.vehicle_number,
        created_by_name: 'Yatish Agarwal',
        created_by_email: 'yatish@crystalgroup.in',
        items: validItems.map((it, i) => ({
          item_name: it.item_name,
          ordered_qty: it.ordered_qty,
          received_qty: it.received_qty,
          invoice_qty: it.invoice_qty || it.received_qty,
          defective_qty: it.defective_qty || '0',
          uom: it.uom,
          condition: it.condition,
          remarks: it.remarks,
        })),
      }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); setSaving(false); return; }
    router.push(`/grns/${encodeURIComponent(data.grn_id)}`);
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 flex items-center justify-between sticky top-0 z-10">
        <Link href="/grns" className="text-sm text-gray-400 hover:text-gray-600">← GRN</Link>
        <div className="font-semibold text-gray-800">Record Goods Receipt</div>
        <div />
      </div>

      <form onSubmit={submit} className="px-4 py-4 md:px-7 md:py-6 space-y-4 max-w-5xl">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

        {/* PO Selection */}
        <Section title="Purchase Order">
          {!selectedPO ? (
            <div className="relative">
              <input value={poSearch} onChange={e => setPoSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:border-indigo-300"
                placeholder="Type PO ID, vendor name, or site (min 2 chars)..." />
              {loadingPO && <div className="absolute top-full left-0 mt-1 w-96 bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-400">Loading PO...</div>}
              {poResults.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-[500px] bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                  {poResults.map((po: any) => (
                    <button type="button" key={po.PO_ID} onClick={() => loadPO(po.PO_ID)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-50">
                      <div>
                        <div className="text-sm font-mono font-medium text-indigo-600">{po.PO_ID}</div>
                        <div className="text-xs text-gray-500">{po.Site} · {po.Vendor_Company_Name || po.Vendor_ID}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium">{po.Total_Incl_GST ? `₹${parseFloat(String(po.Total_Incl_GST).replace(/[₹,]/g,'')).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}</div>
                        <div className="text-xs text-gray-400">{po.received_pct}% received</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 flex-1 mr-4">
                <div className="font-semibold text-indigo-800 font-mono">{selectedPO.PO_ID}</div>
                <div className="text-sm text-indigo-600 mt-0.5">
                  {selectedPO.Site} · {poData?.vendor?.Company_Name || selectedPO.Vendor_Company_Name || selectedPO.Vendor_ID}
                </div>
                <div className="text-xs text-indigo-400 mt-1">{selectedPO.PO_Date} · {selectedPO.Total_Incl_GST ? `₹${parseFloat(String(selectedPO.Total_Incl_GST).replace(/[₹,]/g,'')).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : ''}</div>
              </div>
              {!prefilledPO && (
                <button type="button" onClick={() => { setSelectedPO(null); setPOData(null); setItems([]); setPoSearch(''); }}
                  className="text-sm text-gray-400 hover:text-gray-600 mt-1">Change PO</button>
              )}
            </div>
          )}
        </Section>

        {selectedPO && (
          <>
            {/* Invoice Details */}
            <Section title="Invoice & Logistics">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Invoice Number <span className="text-red-400">*</span></label>
                  <input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                    placeholder="INV/2025/001" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Invoice Value <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input type="number" min="0" value={form.invoice_value} onChange={e => set('invoice_value', e.target.value)}
                      className="border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Invoice Date</label>
                  <input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">LR / Docket Number</label>
                  <input value={form.lr_number} onChange={e => set('lr_number', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                    placeholder="Courier or transport LR no." />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Vehicle Number</label>
                  <input value={form.vehicle_number} onChange={e => set('vehicle_number', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300"
                    placeholder="MH 01 AB 1234" />
                </div>
              </div>
            </Section>

            {/* Items */}
            <Section title="Items Received">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400">
                      <th className="text-left pb-2">#</th>
                      <th className="text-left pb-2 min-w-40">Item</th>
                      <th className="text-right pb-2">Ordered</th>
                      <th className="text-right pb-2">Received <span className="text-red-400">*</span></th>
                      <th className="text-right pb-2">Invoice Qty</th>
                      <th className="text-right pb-2">Defective</th>
                      <th className="text-left pb-2 pl-2">UOM</th>
                      <th className="text-left pb-2">Condition</th>
                      <th className="text-left pb-2 min-w-32">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item._id} className="border-b border-gray-50">
                        <td className="py-2 text-gray-400 text-xs pr-2">{idx + 1}</td>
                        <td className="py-2 pr-2">
                          <div className="text-sm font-medium text-gray-700">{item.item_name}</div>
                        </td>
                        <td className="py-2 text-right text-gray-400 pr-2">{item.ordered_qty}</td>
                        <td className="py-2 pr-2">
                          <input type="number" min="0" value={item.received_qty} onChange={e => setItem(idx, 'received_qty', e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-sm w-20 text-right focus:outline-none focus:border-indigo-300 font-medium" />
                        </td>
                        <td className="py-2 pr-2">
                          <input type="number" min="0" value={item.invoice_qty} onChange={e => setItem(idx, 'invoice_qty', e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-sm w-20 text-right focus:outline-none focus:border-indigo-300"
                            placeholder={item.received_qty} />
                        </td>
                        <td className="py-2 pr-2">
                          <input type="number" min="0" value={item.defective_qty} onChange={e => setItem(idx, 'defective_qty', e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-sm w-20 text-right focus:outline-none focus:border-indigo-300" />
                        </td>
                        <td className="py-2 pr-2 pl-2 text-gray-500 text-xs">{item.uom}</td>
                        <td className="py-2 pr-2">
                          <select value={item.condition} onChange={e => setItem(idx, 'condition', e.target.value)}
                            className={`border rounded px-2 py-1 text-xs w-24 focus:outline-none focus:border-indigo-300
                              ${item.condition === 'Good' ? 'border-green-200 text-green-700 bg-green-50'
                                : item.condition === 'Damaged' ? 'border-red-200 text-red-700 bg-red-50'
                                : 'border-amber-200 text-amber-700 bg-amber-50'}`}>
                            {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="py-2">
                          <input value={item.remarks} onChange={e => setItem(idx, 'remarks', e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-indigo-300"
                            placeholder="Any notes..." />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>Enter 0 for items not received in this delivery</span>
                <span>
                  Total received:{' '}
                  <span className="font-semibold text-gray-700">
                    {items.reduce((s, it) => s + (parseFloat(it.received_qty) || 0), 0)}
                  </span>
                  {items.some(it => parseFloat(it.defective_qty) > 0) && (
                    <span className="ml-3 text-red-500 font-semibold">
                      Defective: {items.reduce((s, it) => s + (parseFloat(it.defective_qty) || 0), 0)}
                    </span>
                  )}
                </span>
              </div>
            </Section>

            <div className="flex justify-end gap-3 pb-6">
              <Link href="/grns" className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</Link>
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Recording...' : 'Record GRN'}
              </button>
            </div>
          </>
        )}
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
export default function NewGRN() {
  return <Suspense><NewGRNInner /></Suspense>;
}
