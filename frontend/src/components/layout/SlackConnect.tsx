'use client';

import { useState } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { api } from '@/lib/api';
import { SlackIcon } from '../ui/icons';
import { useToast } from '../ui/Toast';

/** Sidebar card: connect Slack (OAuth) or show the connected workspace with Test / Disconnect. */
export function SlackConnect() {
  const { user, refreshUser } = useDashboard();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { slack } = user;

  if (!slack.connected) {
    return (
      <button
        // Full-page navigation: the backend redirects to Slack's OAuth consent screen.
        onClick={() => (window.location.href = api.slackConnectUrl)}
        title={slack.configured ? 'Get notified in Slack when an hourly limit is hit' : 'Slack OAuth is not configured on the server'}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <SlackIcon />
        Connect Slack
      </button>
    );
  }

  const run = async (kind: 'test' | 'disconnect') => {
    setBusy(true);
    try {
      if (kind === 'test') {
        await api.testSlack();
        toast.success('Test message sent to Slack.');
      } else {
        await api.disconnectSlack();
        toast.info('Slack disconnected.');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      await refreshUser();
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2 text-gray-700">
        <SlackIcon />
        <span className="min-w-0 flex-1 truncate font-medium">{slack.teamName ?? 'Slack'}</span>
        <span className="h-2 w-2 rounded-full bg-brand-500" aria-label="connected" />
      </div>
      {slack.channel && <p className="mt-0.5 truncate pl-6 text-gray-400">{slack.channel}</p>}
      <div className="mt-2 flex gap-3 pl-6">
        <button disabled={busy} onClick={() => void run('test')} className="font-medium text-brand-700 hover:underline disabled:opacity-50">
          Send test
        </button>
        <button disabled={busy} onClick={() => void run('disconnect')} className="text-gray-500 hover:text-red-600 disabled:opacity-50">
          Disconnect
        </button>
      </div>
    </div>
  );
}
