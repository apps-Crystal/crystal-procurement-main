'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSite } from '@/context/SiteContext';
import { useUser } from '@/context/UserContext';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

const SITES = [
  { label: 'All Sites', value: 'all' },
  { label: 'Noida', value: 'Noida' },
  { label: 'Detroj', value: 'Detroj' },
  { label: 'Pune', value: 'Pune' },
  { label: 'Kheda', value: 'Kheda' },
  { label: 'Kolkata', value: 'Kolkata' },
  { label: 'Bhubaneswar', value: 'Bhubaneswar' },
  { label: 'Dhulagarh', value: 'Dhulagarh' },
  { label: 'Dankuni', value: 'Dankuni' },
  { label: 'Mumbai', value: 'Mumbai' },
  { label: 'Vavdi', value: 'Vavdi' },
  { label: 'Taloja', value: 'Taloja' },
];

const nav = [
  { href: '/', label: 'Dashboard', icon: '⊞' },
  { href: '/prs', label: 'Purchase Requests', icon: '📋', badge: null },
  { href: '/pos', label: 'Purchase Orders', icon: '📄' },
  { href: '/grns', label: 'GRN', icon: '📦' },
  { href: '/vendors', label: 'Vendors', icon: '🏢' },
];

export default function Sidebar({ pendingPRs = 0, onClose }: { pendingPRs?: number; onClose?: () => void }) {
  const pathname = usePathname();
  const { site, setSite } = useSite();
  const user = useUser();

  const displayName = user?.name?.trim() || 'Yatish Agarwal';
  const displayInitials = user ? initialsOf(displayName) : 'YA';
  const roleLabel = user?.role ? titleCase(user.role) : 'Admin';
  const siteLabel = site === 'all' ? 'All Sites' : site;

  return (
    <div className="w-52 flex-shrink-0 flex flex-col h-full min-h-screen" style={{ background: '#0f172a' }}>
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="text-white font-bold text-sm">Crystal Group</div>
        <div className="text-slate-500 text-xs mt-0.5">Procurement Portal</div>
      </div>

      <div className="px-3 py-4 flex-1">
        <nav className="space-y-0.5">
          {nav.map(item => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={() => onClose?.()}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${active ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.href === '/prs' && pendingPRs > 0 && (
                  <span className="bg-indigo-500 text-white text-xs rounded-full px-1.5 py-0.5 font-semibold">{pendingPRs}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-4 py-4 border-t border-slate-800">
        <div className="text-slate-500 text-xs mb-1.5">Site Filter</div>
        <select value={site} onChange={e => setSite(e.target.value)}
          className="w-full text-sm rounded-lg px-2.5 py-1.5 border border-slate-700 text-slate-300"
          style={{ background: '#1e293b' }}>
          {SITES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {site !== 'all' && (
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-xs text-indigo-400 font-medium">Filtering: {site}</span>
            <button onClick={() => setSite('all')} className="text-xs text-slate-500 hover:text-slate-300">✕ clear</button>
          </div>
        )}
        <div className="mt-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">{displayInitials}</div>
          <div className="min-w-0">
            <div className="text-slate-300 text-xs font-medium truncate" title={displayName}>{displayName}</div>
            <div className="text-slate-500 text-xs truncate">{roleLabel} · {siteLabel}</div>
          </div>
        </div>
        <a
          href="/logout"
          className="mt-3 flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-800 transition-all"
        >
          <span className="text-base">⎋</span>
          <span>Logout</span>
        </a>
      </div>
    </div>
  );
}
