'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSite } from '@/context/SiteContext';

const STATUS_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Submitted', value: 'PR_SUBMITTED' },
  { label: 'Approved', value: 'PR_APPROVED' },
  { label: 'PO Posted', value: 'PO_POSTED' },
  { label: 'Rejected', value: 'PR_REJECTED' },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PR_SUBMITTED: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
  PR_APPROVED:  { label: 'Approved',  cls: 'bg-green-100 text-green-700' },
  PR_REJECTED:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700' },
  PO_POSTED:    { label: 'PO Posted', cls: 'bg-purple-100 text-purple-700' },
};

function fmt(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n.replace(/[₹,]/g, '')) : n;
  if (!v || isNaN(v)) return '—';
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function PRListInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { site } = useSite();
  const [prs, setPRs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ status });
    if (site && site !== 'all') params.set('site', site);
    fetch(`/api/prs?${params}`)
      .then(r => r.json())
      .then(d => { setPRs(d.prs || []); setLoading(false); });
  }, [status, site]);

  const filtered = prs.filter(pr =>
    !search || pr.PR_ID?.toLowerCase().includes(search.toLowerCase()) ||
    pr.PR_Purpose?.toLowerCase().includes(search.toLowerCase()) ||
    pr.Site?.toLowerCase().includes(search.toLowerCase()) ||
    pr.Vendor_ID?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="font-semibold text-gray-800">Purchase Requests</div>
        <Link href="/prs/new" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">+ New PR</Link>
      </div>

      <div className="px-4 py-4 md:px-7 md:py-6 flex-1">
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1">
              {STATUS_TABS.map(t => (
                <button key={t.value} onClick={() => setStatus(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${status === t.value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:border-indigo-300"
                placeholder="Search PR ID, purpose, site..." />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['PR ID', 'Date', 'Site', 'Purpose', 'Category', 'Amount', 'Status', 'Aging'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">Loading PRs from Google Sheets...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">No PRs found</td></tr>
              )}
              {!loading && filtered.map(pr => {
                const badge = STATUS_BADGE[pr.Status_Code] || { label: pr.Status_Label || pr.Status_Code, cls: 'bg-gray-100 text-gray-600' };
                const days = parseInt(pr.aging_days) || 0;
                const agingCls = days >= 7 ? 'text-red-500 font-semibold' : days >= 3 ? 'text-amber-500 font-semibold' : 'text-gray-400';
                return (
                  <tr key={pr.PR_ID} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/prs/${encodeURIComponent(pr.PR_ID)}`)}>

                    <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-medium">{pr.PR_ID}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{pr.Date_of_Requisition?.split(' ')[0] || pr.Timestamp?.split(' ')[0]}</td>
                    <td className="px-4 py-3 font-medium">{pr.Site}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{pr.PR_Purpose}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{pr.Purchase_Category}</td>
                    <td className="px-4 py-3 font-medium text-right">{fmt(pr.Total_Incl_GST)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className={`px-4 py-3 text-xs ${agingCls}`}>{days > 0 ? `${days}d` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              Showing {filtered.length} of {prs.length} PRs
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PRList() {
  return <Suspense><PRListInner /></Suspense>;
}
