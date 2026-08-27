'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button, inputClass } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/add';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setNotice('Check your inbox for a confirmation link, then sign in.');
          setMode('signin');
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-7 px-6 py-12">
      <div>
        <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-brand text-2xl font-extrabold text-on-brand">
          ¥
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-2 leading-relaxed text-dim">
          Type what you spent — <span className="font-semibold text-ink">lunch 1200</span> — and it lands in the right category, on the
          right day.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />

        {error && (
          <p className="rounded-xl bg-down-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-down">{error}</p>
        )}
        {notice && (
          <p className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-brand">{notice}</p>
        )}

        <Button type="submit" loading={busy}>
          {mode === 'signin' ? 'Sign in' : 'Sign up'}
        </Button>
      </form>

      <p className="text-center text-[13.5px] text-dim">
        {mode === 'signin' ? "Don't have an account?" : 'Already have one?'}{' '}
        <button
          type="button"
          className="font-semibold text-brand"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setNotice(null);
          }}
        >
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>

      <p className="text-center text-[11.5px] leading-relaxed text-faint">
        Your data is locked to your account by row-level security.
        <br />
        Add this page to your Home Screen for a fullscreen app.
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
