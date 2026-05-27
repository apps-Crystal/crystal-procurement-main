'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import { SiteProvider } from '@/context/SiteContext';
import { UserProvider, type User } from '@/context/UserContext';

export default function ClientLayout({
  children,
  user,
}: {
  children: React.ReactNode;
  user: User | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <UserProvider user={user}>
      <SiteProvider>
        {/* Mobile overlay */}
        {open && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Sidebar — fixed on mobile (slides in), static on desktop */}
        <div
          className={`fixed inset-y-0 left-0 z-50 lg:static lg:flex-shrink-0 transition-transform duration-200
            ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
          <Sidebar onClose={() => setOpen(false)} />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-screen overflow-auto min-w-0">
          {/* Mobile top bar (hidden on desktop) */}
          <div className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
            <button
              onClick={() => setOpen(true)}
              className="text-gray-600 hover:text-gray-900 p-0.5"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-semibold text-gray-800 text-sm">Crystal Procurement</span>
          </div>
          {children}
        </div>
      </SiteProvider>
    </UserProvider>
  );
}
