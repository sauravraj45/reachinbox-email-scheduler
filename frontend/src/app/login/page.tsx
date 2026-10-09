'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';

const inputCls =
  'h-11 w-full rounded-md bg-gray-100 px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-100';

function LoginCard() {
  const router = useRouter();
  const urlError = useSearchParams().get('error');
  const [error, setError] = useState<string | null>(urlError);
  const [redirecting, setRedirecting] = useState(false);

  // Already logged in? Go straight to the dashboard.
  useEffect(() => {
    api.me().then(() => router.replace('/dashboard')).catch(() => undefined);
  }, [router]);

  const loginWithGoogle = () => {
    setRedirecting(true);
    window.location.href = api.googleLoginUrl;
  };

  // The design shows an email/password form; this deployment only supports Google sign-in.
  const onEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('Email & password sign-in is not enabled. Please continue with Google.');
  };

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-gray-100 bg-white px-8 py-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <h1 className="text-center text-2xl font-medium text-gray-900">Login</h1>

      <button
        onClick={loginWithGoogle}
        disabled={redirecting}
        className="mt-8 flex h-11 w-full items-center justify-center gap-2.5 rounded-md bg-brand-50 text-sm font-medium text-gray-800 transition-colors hover:bg-brand-100 disabled:opacity-70"
      >
        {redirecting ? <Spinner className="h-4 w-4" /> : <GoogleIcon />}
        Login with Google
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-100" />
        or sign up through email
        <span className="h-px flex-1 bg-gray-100" />
      </div>

      <form onSubmit={onEmailSubmit} className="flex flex-col gap-3">
        <input type="email" placeholder="Email ID" aria-label="Email ID" autoComplete="email" className={inputCls} />
        <input type="password" placeholder="Password" aria-label="Password" autoComplete="current-password" className={inputCls} />
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <button type="submit" className="mt-3 h-11 w-full rounded-md bg-brand-600 text-sm font-medium text-white transition-colors hover:bg-brand-700">
          Login
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4">
      <Suspense fallback={<Spinner />}>
        <LoginCard />
      </Suspense>
    </main>
  );
}
