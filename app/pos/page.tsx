'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSite } from '@/context/SiteContext';

function fmt(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n.replace(/[₹,]/g, '')) : n;
  if (!v || isNaN(v)) return '—';
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function POListInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { site } = useSite();
  const [pos, setPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [search, setSearch] = useState('');
  const urlStatus = searchParams.get('status') || 'all';

  // Sync local status to URL when sidebar links change it
  useEffect(() => {
    if (urlStatus !== status) setStatus(urlStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStatus]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ status });
    if (site && site !== 'all') params.set('site', site);
    fetch(`/api/pos?${params}`)
      .then(r => r.json())
      .then(d => { setPOs(d.pos || []); setLoading(false); });
  }, [status, site]);

  const filtered = pos.filter(po =>
    !search || po.PO_ID?.toLowerCase().includes(search.toLowerCase()) ||
    po.Vendor_Company_Name?.toLowerCase().includes(search.toLowerCase()) ||
    po.Site?.toLowerCase().includes(search.toLowerCase()) ||
    po.PR_ID?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="font-semibold text-gray-800">Purchase Orders</div>
        <Link href="/pos/new" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">+ New PO</Link>
      </div>

      <div className="px-4 py-4 md:px-7 md:py-6 flex-1">
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1">
              {[['All', 'all'], ['Posted', 'PO_POSTED'], ['Cancelled', 'CANCELLED'], ['Archived', 'ARCHIVED']].map(([label, value]) => (
                <button key={value} onClick={() => setStatus(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${status === value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto">
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:border-indigo-300"
                placeholder="Search PO ID, vendor, site..." />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['PO ID', 'Tally No.', 'Date', 'Site', 'PR ID', 'Vendor', 'Amount', 'Delivery', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">Loading POs...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">No POs found</td></tr>}
              {!loading && filtered.map(po => {
                const pct = parseInt(po.received_pct) || 0;
                const delay = parseInt(po.delay_days) || 0;
                return (
                  <tr key={po.PO_ID} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/pos/${encodeURIComponent(po.PO_ID)}`)}>

                    <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-medium">{po.PO_ID}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{po.PO_No_Tally || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{po.PO_Date}</td>
                    <td className="px-4 py-3 font-medium">{po.Site}</td>
                    <td className="px-4 py-3 font-mono text-xs text-indigo-400">{po.PR_ID}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{po.Vendor_Company_Name || po.Vendor_ID}</td>
                    <td className="px-4 py-3 font-medium text-right">{fmt(po.Total_Incl_GST)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${delay > 0 ? 'bg-red-400' : 'bg-indigo-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs ${delay > 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                          {delay > 0 ? `${delay}d late` : `${pct}%`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        po.Status_Code === 'PO_POSTED' ? 'bg-blue-100 text-blue-700' :
                        po.Status_Code === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        po.Status_Code === 'ARCHIVED' ? 'bg-slate-200 text-slate-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {po.Status_Label || po.Status_Code}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">Showing {filtered.length} of {pos.length} POs</div>}
        </div>
      </div>
    </div>
  );
}

export default function POList() {
  return <Suspense><POListInner /></Suspense>;
}
