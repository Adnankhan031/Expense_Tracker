export const dynamic = 'force-dynamic';

export default function SetupPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-brand">Spendly</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {configured ? 'Almost there' : 'One step left'}
        </h1>
        <p className="mt-3 leading-relaxed text-dim">
          {configured
            ? 'Supabase is connected. If you are seeing this page, try reloading.'
            : 'This app needs a Supabase project for sign-in and storage. It takes about two minutes to set up.'}
        </p>
      </div>

      {!configured && (
        <ol className="flex flex-col gap-4 text-[14.5px] leading-relaxed">
          {[
            ['Create a free project', 'Go to supabase.com, sign in, and create a new project. Any region near you is fine.'],
            [
              'Run the schema',
              'In the project, open SQL Editor → New query, paste the contents of web/supabase/schema.sql from the repo, and run it.',
            ],
            [
              'Copy two values',
              'Project Settings → API. Copy the Project URL and the anon / public key. The anon key is safe to ship in a browser app — row-level security is what protects the data.',
            ],
            [
              'Add them as environment variables',
              'In Vercel: Project → Settings → Environment Variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy. Locally, put them in web/.env.local.',
            ],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-3.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-xs font-bold text-brand">
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-0.5 block text-dim">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <pre className="overflow-x-auto rounded-xl border border-line bg-surface p-4 text-[12.5px] leading-relaxed text-dim">
        {`NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...`}
      </pre>

      <p className="text-[12.5px] leading-relaxed text-faint">
        Nothing is stored anywhere until you connect a project. Once connected, every row is locked to your account by
        row-level security — another signed-in user cannot read your spending.
      </p>
    </main>
  );
}
