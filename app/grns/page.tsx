'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSite } from '@/context/SiteContext';

const STATUS_BADGE: Record<string, string> = {
  Draft:    'bg-yellow-100 text-yellow-700',
  Open:     'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Flagged:  'bg-red-100 text-red-700',
};

function fmt(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n.replace(/[₹,]/g, '')) : n;
  if (!v || isNaN(v)) return '—';
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function GRNListInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { site } = useSite();
  const [grns, setGRNs] = useState<any[]>([]);
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
    fetch(`/api/grns?${params}`)
      .then(r => r.json())
      .then(d => { setGRNs(d.grns || []); setLoading(false); });
  }, [status, site]);

  const filtered = grns.filter(g =>
    !search || g.GRN_ID?.toLowerCase().includes(search.toLowerCase()) ||
    g.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
    g.Site?.toLowerCase().includes(search.toLowerCase()) ||
    g['Invoice Number']?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="font-semibold text-gray-800">GRN</div>
        <Link href="/grns/new" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">+ New GRN</Link>
      </div>

      <div className="px-4 py-4 md:px-7 md:py-6 flex-1">
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1">
              {[['All', 'all'], ['Draft', 'Draft'], ['Open', 'Open'], ['Approved', 'Approved']].map(([label, value]) => (
                <button key={value} onClick={() => setStatus(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${status === value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto">
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:border-indigo-300"
                placeholder="Search GRN ID, vendor, invoice..." />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['GRN ID', 'PO ID', 'Site', 'Vendor', 'Invoice No.', 'Value', 'Date', 'Status', 'Invoice'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">Loading GRNs...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">No GRNs found</td></tr>}
              {!loading && filtered.map(grn => {
                const badge = STATUS_BADGE[grn.Status] || 'bg-gray-100 text-gray-600';
                const hasInv = grn.has_invoice === 'true';
                const billDays = parseInt(grn.bill_aging_days) || 0;
                return (
                  <tr key={grn.GRN_ID} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/grns/${encodeURIComponent(grn.GRN_ID)}`)}>

                    <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-medium">{grn.GRN_ID}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{grn.PO_ID}</td>
                    <td className="px-4 py-3 font-medium">{grn.Site}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{grn.vendor_name}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{grn['Invoice Number'] || '—'}</td>
                    <td className="px-4 py-3 font-medium">{fmt(grn['Invoice Value'])}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{grn['Invoice_Date'] || grn.Created_At?.split(' ')[0]}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${badge}`}>{grn.Status}</span></td>
                    <td className="px-4 py-3">
                      {hasInv
                        ? <span className="text-green-600 text-xs font-medium">✓ Uploaded</span>
                        : <span className={`text-xs font-medium ${billDays > 7 ? 'text-red-500' : 'text-amber-500'}`}>
                          {billDays > 0 ? `Missing · ${billDays}d` : 'Not uploaded'}
                        </span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">Showing {filtered.length} of {grns.length} GRNs</div>}
        </div>
      </div>
    </div>
  );
}

export default function GRNList() {
  return <Suspense><GRNListInner /></Suspense>;
}
