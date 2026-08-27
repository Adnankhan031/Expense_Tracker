-- Spendly web — Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: everything is idempotent.

-- ---------------------------------------------------------------- categories
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  key         text not null,
  name        text not null,
  icon        text not null default '📦',
  color       text not null default '#90A4AE',
  kind        text not null default 'expense' check (kind in ('expense', 'income')),
  keywords    text not null default '',
  sort        int  not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, key)
);

-- ------------------------------------------------------------------ accounts
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  key         text not null,
  name        text not null,
  kind        text not null default 'cash',
  icon        text not null default '💵',
  sort        int  not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, key)
);

-- -------------------------------------------------------------- transactions
-- Money is stored as integer minor units (paise / cents). Never floats.
-- local_date is the user's calendar day; occurred_at is the absolute instant.
-- Analytics group on local_date so a late-night entry never lands on the wrong day.
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  amount_minor    bigint not null check (amount_minor > 0),
  type            text not null default 'expense' check (type in ('expense', 'income')),
  category_id     uuid references public.categories(id) on delete set null,
  account_id      uuid references public.accounts(id) on delete set null,
  method          text,
  occurred_at     timestamptz not null default now(),
  local_date      date not null,
  note            text,
  raw_input       text,
  source          text not null default 'chat',
  confidence      real not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists idx_txn_user_date on public.transactions (user_id, local_date desc);
create index if not exists idx_txn_user_cat  on public.transactions (user_id, category_id);

-- -------------------------------------------------------- aliases (learning)
-- The table that makes the parser get smarter the more you correct it.
create table if not exists public.aliases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  keyword       text not null,
  category_id   uuid not null references public.categories(id) on delete cascade,
  hits          int not null default 1,
  last_used_at  timestamptz not null default now(),
  unique (user_id, keyword)
);

-- ------------------------------------------------------------------- budgets
create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category_id   uuid references public.categories(id) on delete cascade,
  amount_minor  bigint not null check (amount_minor > 0),
  created_at    timestamptz not null default now()
);

-- One budget row per category, plus one overall row where category_id is null.
create unique index if not exists idx_budget_cat
  on public.budgets (user_id, category_id) where category_id is not null;
create unique index if not exists idx_budget_overall
  on public.budgets (user_id) where category_id is null;

-- ------------------------------------------------------------ chat messages
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'app')),
  kind        text not null default 'text',
  text        text not null default '',
  txn_id      uuid references public.transactions(id) on delete cascade,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_msg_user_created on public.messages (user_id, created_at);

-- ------------------------------------------------------------------ settings
create table if not exists public.settings (
  user_id  uuid not null references auth.users(id) on delete cascade,
  key      text not null,
  value    text not null,
  primary key (user_id, key)
);

-- ----------------------------------------------------------------------- RLS
-- Every table is locked to its owner. Without this, one signed-in user could
-- read another's spending.
alter table public.categories   enable row level security;
alter table public.accounts     enable row level security;
alter table public.transactions enable row level security;
alter table public.aliases      enable row level security;
alter table public.budgets      enable row level security;
alter table public.messages     enable row level security;
alter table public.settings     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','accounts','transactions','aliases','budgets','messages','settings']
  loop
    execute format('drop policy if exists "own rows select" on public.%I', t);
    execute format('drop policy if exists "own rows insert" on public.%I', t);
    execute format('drop policy if exists "own rows update" on public.%I', t);
    execute format('drop policy if exists "own rows delete" on public.%I', t);

    execute format(
      'create policy "own rows select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format(
      'create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- -------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_txn_touch on public.transactions;
create trigger trg_txn_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_cat_touch on public.categories;
create trigger trg_cat_touch before update on public.categories
  for each row execute function public.touch_updated_at();
