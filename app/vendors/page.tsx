'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSite } from '@/context/SiteContext';

export default function VendorList() {
  const router = useRouter();
  const { site } = useSite();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kyc, setKyc] = useState('all');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debounced) params.set('search', debounced);
    if (kyc !== 'all') params.set('kyc', kyc);
    if (site && site !== 'all') params.set('site', site);
    fetch(`/api/vendors?${params}`)
      .then(r => r.json())
      .then(d => { setVendors(d.vendors || []); setLoading(false); });
  }, [debounced, kyc, site]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="font-semibold text-gray-800">Vendors</div>
        <Link href="/vendors/new" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">+ New Vendor</Link>
      </div>

      <div className="px-4 py-4 md:px-7 md:py-6 flex-1">
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex gap-3 items-center">
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-72 focus:outline-none focus:border-indigo-300"
              placeholder="Search name, GST, PAN, vendor ID..." />
            <div className="flex gap-1 ml-2">
              {[['All', 'all'], ['KYC Complete', 'complete'], ['KYC Incomplete', 'incomplete']].map(([label, value]) => (
                <button key={value} onClick={() => setKyc(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${kyc === value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Vendor ID', 'Company Name', 'Contact', 'Phone', 'GST Number', 'Sites', 'KYC', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">Loading vendors...</td></tr>}
              {!loading && vendors.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">No vendors found</td></tr>}
              {!loading && vendors.slice(0, 100).map(v => (
                <tr key={v.Vendor_ID} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/vendors/${encodeURIComponent(v.Vendor_ID)}`)}>

                  <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-medium">{v.Vendor_ID}</td>
                  <td className="px-4 py-3 font-medium">{v.Company_Name}</td>
                  <td className="px-4 py-3 text-gray-500">{v.Contact_Person}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{v.Contact_Number}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{v.GST_Number || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{v.Providing_Sites || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${v.kyc_status === 'complete' ? 'bg-green-100 text-green-700' : v.kyc_status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {v.kyc_label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${v.Active === 'Yes' ? 'text-green-600' : 'text-gray-400'}`}>{v.Active === 'Yes' ? 'Active' : 'Inactive'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            Showing {Math.min(vendors.length, 100)} of {vendors.length} vendors
            {vendors.length > 100 && ' — use search to narrow down'}
          </div>}
        </div>
      </div>
    </div>
  );
}
