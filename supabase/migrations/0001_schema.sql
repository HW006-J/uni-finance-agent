-- Uni Finance Agent: core schema
-- Hackathon MVP, single demo profile, no auth. All access happens
-- server-side via the Supabase service role key, so Row Level Security is
-- enabled with no permissive policies (deny-by-default for anon/authenticated).

create extension if not exists "pgcrypto" with schema extensions;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  currency text not null default 'GBP' check (currency in ('GBP', 'USD', 'EUR')),
  current_balance numeric(12, 2) not null default 0,
  emergency_buffer numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  source text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  date date not null,
  frequency text not null check (frequency in ('one_off', 'weekly', 'monthly', 'termly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  category text not null check (
    category in (
      'rent', 'utilities', 'groceries', 'transport', 'subscriptions',
      'health', 'gym', 'going_out', 'entertainment', 'shopping', 'other'
    )
  ),
  frequency text not null check (frequency in ('one_off', 'weekly', 'monthly', 'termly')),
  next_due_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  merchant text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  category text not null check (
    category in (
      'rent', 'utilities', 'groceries', 'transport', 'subscriptions',
      'health', 'gym', 'going_out', 'entertainment', 'shopping', 'other'
    )
  ),
  date timestamptz not null default now(),
  notes text,
  source text not null default 'chat' check (source in ('chat', 'voice', 'manual')),
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  target_amount numeric(12, 2) not null check (target_amount >= 0),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incomes_profile_id_idx on incomes (profile_id);
create index if not exists expenses_profile_id_idx on expenses (profile_id);
create index if not exists transactions_profile_id_idx on transactions (profile_id);
create index if not exists goals_profile_id_idx on goals (profile_id);

-- Backs the atomic upserts below (ON CONFLICT needs a real unique
-- constraint/index - a select-then-insert/update in plpgsql is not
-- atomic and can race under concurrent calls, e.g. text + voice both
-- adding "Rent" in the same instant).
create unique index if not exists expenses_active_name_uidx on expenses (profile_id, lower(name)) where active;
create unique index if not exists goals_name_uidx on goals (profile_id, lower(name));

alter table profiles enable row level security;
alter table incomes enable row level security;
alter table expenses enable row level security;
alter table transactions enable row level security;
alter table goals enable row level security;
-- Intentionally no policies: only the server-side service role key (which
-- bypasses RLS) may read or write. The anon key has no access.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists incomes_set_updated_at on incomes;
create trigger incomes_set_updated_at before update on incomes
  for each row execute function set_updated_at();

drop trigger if exists expenses_set_updated_at on expenses;
create trigger expenses_set_updated_at before update on expenses
  for each row execute function set_updated_at();

drop trigger if exists goals_set_updated_at on goals;
create trigger goals_set_updated_at before update on goals
  for each row execute function set_updated_at();

-- Atomically insert a transaction and adjust the profile's current balance.
create or replace function log_transaction(
  p_profile_id uuid,
  p_merchant text,
  p_amount numeric,
  p_category text,
  p_date timestamptz,
  p_notes text,
  p_source text
)
returns setof transactions
language plpgsql
as $$
declare
  v_txn transactions;
begin
  insert into transactions (profile_id, merchant, amount, category, date, notes, source)
  values (p_profile_id, p_merchant, p_amount, p_category, coalesce(p_date, now()), p_notes, coalesce(p_source, 'chat'))
  returning * into v_txn;

  update profiles
  set current_balance = current_balance - p_amount
  where id = p_profile_id;

  return next v_txn;
end;
$$;

-- Insert a new expense, or atomically update the existing active expense
-- with a case-insensitive matching name for this profile (so "rent is now
-- £700" updates the existing Rent expense rather than creating a
-- duplicate). Backed by expenses_active_name_uidx - a real ON CONFLICT
-- upsert, not select-then-write, so two concurrent calls for the same
-- name can't both insert.
create or replace function upsert_expense(
  p_profile_id uuid,
  p_name text,
  p_amount numeric,
  p_category text,
  p_frequency text,
  p_next_due_date date
)
returns setof expenses
language sql
as $$
  insert into expenses (profile_id, name, amount, category, frequency, next_due_date)
  values (p_profile_id, p_name, p_amount, p_category, p_frequency, p_next_due_date)
  on conflict (profile_id, (lower(name))) where active
  do update set
    amount = excluded.amount,
    category = excluded.category,
    frequency = excluded.frequency,
    next_due_date = excluded.next_due_date
  returning *;
$$;

-- Insert a new goal, or atomically update the existing goal with a
-- case-insensitive matching name for this profile. Backed by
-- goals_name_uidx.
create or replace function upsert_goal(
  p_profile_id uuid,
  p_name text,
  p_target_amount numeric,
  p_target_date date
)
returns setof goals
language sql
as $$
  insert into goals (profile_id, name, target_amount, target_date)
  values (p_profile_id, p_name, p_target_amount, p_target_date)
  on conflict (profile_id, (lower(name)))
  do update set
    target_amount = excluded.target_amount,
    target_date = excluded.target_date
  returning *;
$$;

-- Clears a profile's stored financial state back to an honest empty state.
-- Used only by the developer/demo reset action, and only ever targets the
-- single demo profile - never a real user's data (this MVP has no other users).
create or replace function reset_demo_profile(p_profile_id uuid)
returns void
language plpgsql
as $$
begin
  delete from transactions where profile_id = p_profile_id;
  delete from expenses where profile_id = p_profile_id;
  delete from incomes where profile_id = p_profile_id;
  delete from goals where profile_id = p_profile_id;

  update profiles
  set current_balance = 0,
      emergency_buffer = null
  where id = p_profile_id;
end;
$$;
