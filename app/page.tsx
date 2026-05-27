'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSite } from '@/context/SiteContext';

interface DashboardData {
  pipeline: { prsAwaitingApproval: number; prsApprovedNoPO: number; posActive: number; grnsPendingApproval: number; grnsApprovedThisMonth: number };
  poValueMTD: number;
  actions: { type: string; id: string; label: string; days?: number; site: string; amount?: string }[];
  siteBreakdown: { site: string; open_prs: number; active_pos: number; pending_grns: number; po_value_mtd: number }[];
}

const actionConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pr_overdue:       { label: 'PR APPROVAL OVERDUE',   color: '#dc2626', bg: '#fef2f2', border: '#ef4444' },
  delivery_delayed: { label: 'DELIVERY DELAYED',       color: '#b45309', bg: '#fffbeb', border: '#f59e0b' },
  bill_missing:     { label: 'INVOICE NOT UPLOADED',   color: '#4338ca', bg: '#eef2ff', border: '#6366f1' },
  qc_hold:          { label: 'QC HOLD',                color: '#b45309', bg: '#fffbeb', border: '#f59e0b' },
};

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

export default function Dashboard() {
  const { site } = useSite();
  const [data, setData]     = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    setLoading(true);
    const params = site && site !== 'all' ? `?site=${encodeURIComponent(site)}` : '';
    fetch(`/api/dashboard${params}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok || d?.error) throw new Error(d?.error || `Request failed (${r.status})`);
        return d;
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [site]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <div className="text-sm text-slate-500">Loading from Google Sheets...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
        <div className="font-semibold text-red-700 mb-1">Could not load dashboard</div>
        <div className="text-sm text-red-600">{error}</div>
      </div>
    </div>
  );

  const p = data!.pipeline;

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="font-semibold text-gray-800">Dashboard</div>
        <Link href="/prs/new" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + New PR
        </Link>
      </div>

      <div className="flex-1 px-4 py-4 md:px-7 md:py-6 space-y-5">
        {/* Pipeline funnel */}
        <div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Procurement Pipeline</div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
            {[
              { num: p.prsAwaitingApproval,   label: 'PRs Awaiting\nApproval',     href: '/prs?status=PR_SUBMITTED', color: '#3b82f6' },
              { num: p.prsApprovedNoPO,        label: 'Approved\n— No PO Yet',      href: '/prs?status=PR_APPROVED',  color: '#10b981' },
              { num: p.posActive,              label: 'POs Active\nIn Delivery',    href: '/pos?status=PO_POSTED',    color: '#6366f1' },
              { num: p.grnsPendingApproval,    label: 'GRNs Pending\nApproval',     href: '/grns?status=Open',        color: '#f59e0b' },
              { num: p.grnsApprovedThisMonth,  label: 'GRNs Approved\nThis Month',  href: '/grns?status=Approved',    color: '#10b981' },
            ].map((item, i) => (
              <div key={item.href} className="flex items-center gap-2 flex-1">
                <Link href={item.href} className="flex-1 bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-indigo-200 hover:shadow-sm transition-all">
                  <div className="text-3xl font-extrabold leading-none mb-1" style={{ color: item.color }}>{item.num}</div>
                  <div className="text-xs text-gray-500 whitespace-pre-line font-medium">{item.label}</div>
                </Link>
                {i < 4 && <div className="text-gray-300 text-lg flex-shrink-0">→</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Site breakdown */}
          <div className="col-span-1 lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Site Breakdown — This Month</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-xs font-semibold text-gray-400">Site</th>
                  <th className="text-center pb-2 text-xs font-semibold text-gray-400">Open PRs</th>
                  <th className="text-center pb-2 text-xs font-semibold text-gray-400">Active POs</th>
                  <th className="text-center pb-2 text-xs font-semibold text-gray-400">Pending GRNs</th>
                  <th className="text-right pb-2 text-xs font-semibold text-gray-400">PO Value (MTD)</th>
                </tr>
              </thead>
              <tbody>
                {(data!.siteBreakdown || [])
                  .filter(s => s.open_prs + s.active_pos + s.pending_grns > 0)
                  .map(s => (
                    <tr key={s.site} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-medium">{s.site}</td>
                      <td className="py-2.5 text-center">
                        {s.open_prs > 0
                          ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{s.open_prs}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 text-center text-gray-600">{s.active_pos || '—'}</td>
                      <td className="py-2.5 text-center">
                        {s.pending_grns > 0
                          ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{s.pending_grns}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 text-right font-medium text-gray-700">{s.po_value_mtd > 0 ? fmt(s.po_value_mtd) : '—'}</td>
                    </tr>
                  ))}
                <tr className="border-t-2 border-gray-200">
                  <td className="py-2 font-bold">Total</td>
                  <td className="py-2 text-center font-bold">{data!.siteBreakdown.reduce((s, r) => s + r.open_prs, 0)}</td>
                  <td className="py-2 text-center font-bold">{data!.siteBreakdown.reduce((s, r) => s + r.active_pos, 0)}</td>
                  <td className="py-2 text-center font-bold">{data!.siteBreakdown.reduce((s, r) => s + r.pending_grns, 0)}</td>
                  <td className="py-2 text-right font-bold">{fmt(data!.poValueMTD)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action items */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Needs Attention</div>
            {data!.actions.length === 0 && (
              <div className="text-sm text-gray-400 text-center py-8">All clear ✓</div>
            )}
            <div className="space-y-2">
              {data!.actions.map((action, i) => {
                const cfg = actionConfig[action.type] || actionConfig.pr_overdue;
                const href = action.type.startsWith('pr') ? `/prs/${encodeURIComponent(action.id)}`
                  : action.type === 'delivery_delayed' ? `/pos/${encodeURIComponent(action.id)}`
                  : `/grns/${encodeURIComponent(action.id)}`;
                return (
                  <Link key={`${action.type}-${action.id}`} href={href}
                    className="block border-l-4 rounded-r-lg p-2.5 hover:opacity-90 transition-opacity"
                    style={{ borderColor: cfg.border, background: cfg.bg }}>
                    <div className="text-xs font-bold mb-0.5" style={{ color: cfg.color }}>{cfg.label}</div>
                    <div className="text-sm font-medium text-gray-800 font-mono">{action.id}</div>
                    <div className="text-xs text-gray-500">{action.label}{action.days ? ` · ${action.days} days` : ''}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
