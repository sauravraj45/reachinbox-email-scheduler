'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/Header';
import { PageSpinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { DashboardProvider } from '@/hooks/useDashboard';
import { useApi } from '@/hooks/useApi';
import { api, ApiError } from '@/lib/api';

export default function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  const router = useRouter();
  const toast = useToast();

  const me = useApi(async () => {
    try {
      return await api.me();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return null;
      }
      throw err;
    }
  }, [router]);
  const stats = useApi(() => api.stats(), [], { pollMs: 5000, enabled: Boolean(me.data) });

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    router.replace('/login');
  }, [router]);

  // Surface the result of the Slack OAuth round-trip (?slack=connected|error|...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slack = params.get('slack');
    if (!slack) return;
    if (slack === 'connected') toast.success('Slack connected — you will be notified when an hourly limit is hit.');
    else if (slack === 'not_configured') toast.error('Slack OAuth is not configured on the server.');
    else toast.error(`Slack connection failed (${slack}).`);
    params.delete('slack');
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () =>
      me.data
        ? { user: me.data, stats: stats.data, refreshUser: me.reload, refreshStats: stats.reload, logout }
        : null,
    [me.data, me.reload, stats.data, stats.reload, logout],
  );

  if (me.error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-red-600">{me.error}</p>
        <button className="text-sm font-medium text-brand-700 underline" onClick={() => void me.reload()}>
          Retry
        </button>
      </div>
    );
  }
  if (!value) return <PageSpinner />;

  return (
    <DashboardProvider value={value}>
      <div className="flex h-screen overflow-hidden bg-white">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader />
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
        </div>
      </div>
    </DashboardProvider>
  );
}
