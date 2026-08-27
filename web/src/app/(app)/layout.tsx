import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { StoreProvider } from '@/lib/store';
import { TabBar } from '@/components/TabBar';

// These screens are per-user, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();

  // Not configured yet. Render the pointer inline rather than redirecting —
  // a redirect from a layout is evaluated at build time and takes the build
  // down before the environment variables have been set.
  if (!supabase) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Connect Supabase</h1>
        <p className="leading-relaxed text-dim">
          Set <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then redeploy.
        </p>
        <Link href="/setup" className="font-semibold text-brand">
          Show me how →
        </Link>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <StoreProvider user={user}>
      <div className="safe-t mx-auto min-h-dvh w-full max-w-2xl pb-[calc(72px+env(safe-area-inset-bottom,0px))]">
        {children}
      </div>
      <TabBar />
    </StoreProvider>
  );
}
