'use client';
import { createContext, useContext, useState } from 'react';

type SiteContextType = {
  site: string;
  setSite: (s: string) => void;
};

const SiteContext = createContext<SiteContextType>({ site: 'all', setSite: () => {} });

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [site, setSite] = useState('all');
  return <SiteContext.Provider value={{ site, setSite }}>{children}</SiteContext.Provider>;
}

export function useSite() {
  return useContext(SiteContext);
}
