'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { EmailStats, User } from '@/lib/types';

export interface DashboardContextValue {
  user: User;
  stats: EmailStats | null;
  refreshUser: () => Promise<void>;
  refreshStats: () => Promise<void>;
  logout: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ value, children }: { value: DashboardContextValue; children: ReactNode }) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside the dashboard layout');
  return ctx;
}
