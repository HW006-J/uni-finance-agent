-- Budget V2: distinguishes current cash from total funding awards and
-- received/future income events, and adds an explicit budgeting horizon.
-- Purely additive/backwards-compatible - no existing column, table or row
-- is dropped, renamed or destructively rewritten. Safe to run against the
-- live demo database ahead of merging the feature branch.

-- ---------------------------------------------------------------------------
-- profiles: track whether the current balance has actually been told to us
-- (vs the numeric default of 0), plus an optional explicit "must last
-- until" budgeting horizon the student can state directly.
-- ---------------------------------------------------------------------------
alter table profiles
  add column if not exists balance_known boolean not null default false,
  add column if not exists balance_updated_at timestamptz,
  add column if not exists budget_horizon_date date,
  add column if not exists budget_horizon_note text;

-- Backfill: a profile that has already had its balance touched (nonzero
-- balance, or updated since creation) clearly does have a known balance -
-- don't regress the existing deployed demo profile into "not provided".
update profiles
set balance_known = true,
    balance_updated_at = updated_at
where balance_known = false
  and (current_balance <> 0 or updated_at <> created_at);

-- ---------------------------------------------------------------------------
-- funding_awards: a TOTAL funding amount across a period (e.g. "£10,000
-- Maintenance Loan for the academic year"). This is informational period
-- funding, never treated as current cash or as a single future payment -
-- see record_funding_award tool / get_period_budget_summary.
-- ---------------------------------------------------------------------------
create table if not exists funding_awards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  source text not null,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  period_start date,
  period_end date,
  schedule_known boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funding_awards_profile_id_idx on funding_awards (profile_id);

-- Matched by source name (case-insensitive), same upsert pattern as
-- expenses/incomes/goals, so restating "my total loan is now £11,000"
-- updates the existing award rather than creating a duplicate.
create unique index if not exists funding_awards_name_uidx on funding_awards (profile_id, lower(source));

drop trigger if exists funding_awards_set_updated_at on funding_awards;
create trigger funding_awards_set_updated_at before update on funding_awards
  for each row execute function set_updated_at();

create or replace function upsert_funding_award(
  p_profile_id uuid,
  p_source text,
  p_total_amount numeric,
  p_period_start date,
  p_period_end date,
  p_schedule_known boolean,
  p_notes text
)
returns setof funding_awards
language sql
as $$
  insert into funding_awards (profile_id, source, total_amount, period_start, period_end, schedule_known, notes)
  values (p_profile_id, p_source, p_total_amount, p_period_start, p_period_end, coalesce(p_schedule_known, false), p_notes)
  on conflict (profile_id, (lower(source)))
  do update set
    total_amount = excluded.total_amount,
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    schedule_known = excluded.schedule_known,
    notes = excluded.notes
  returning *;
$$;

-- ---------------------------------------------------------------------------
-- income_receipts: an audit trail of maintenance/other payments the
-- student says have actually arrived. Deliberately separate from the
-- `incomes` table (which represents expected/future payment patterns) so a
-- received payment is never confused with a future instalment.
--
-- Whether a receipt is folded into current_balance depends on whether the
-- balance was already known: if we don't know the student's starting
-- balance, adding the receipt on top of the numeric default would silently
-- assert "your total balance IS this payment", which is exactly the bug
-- this feature fixes. So receipts are only applied to current_balance when
-- balance_known was already true; otherwise they're recorded for history
-- and the AI is expected to ask for the current total (see system prompt).
-- ---------------------------------------------------------------------------
create table if not exists income_receipts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  source text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  occurred_on date not null,
  notes text,
  applied_to_balance boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists income_receipts_profile_id_idx on income_receipts (profile_id);

-- Idempotency guard mirroring 0004_dedupe_transactions.sql: a retried
-- identical receipt within a short window returns the existing row instead
-- of double-crediting the balance.
create or replace function record_income_received(
  p_profile_id uuid,
  p_source text,
  p_amount numeric,
  p_occurred_on date,
  p_notes text
)
returns table (
  receipt_id uuid,
  receipt_source text,
  receipt_amount numeric,
  receipt_occurred_on date,
  receipt_notes text,
  receipt_applied_to_balance boolean,
  receipt_created_at timestamptz,
  profile_balance_known boolean,
  profile_current_balance numeric
)
language plpgsql
as $$
declare
  v_receipt income_receipts;
  v_balance_known boolean;
begin
  select * into v_receipt
  from income_receipts
  where profile_id = p_profile_id
    and source = p_source
    and amount = p_amount
    and occurred_on = coalesce(p_occurred_on, current_date)
    and created_at > now() - interval '10 seconds'
  order by created_at desc
  limit 1;

  if not found then
    select balance_known into v_balance_known from profiles where id = p_profile_id;

    insert into income_receipts (profile_id, source, amount, occurred_on, notes, applied_to_balance)
    values (p_profile_id, p_source, p_amount, coalesce(p_occurred_on, current_date), p_notes, coalesce(v_balance_known, false))
    returning * into v_receipt;

    if coalesce(v_balance_known, false) then
      update profiles
      set current_balance = current_balance + p_amount,
          balance_updated_at = now()
      where id = p_profile_id;
    end if;
  end if;

  return query
  select
    v_receipt.id,
    v_receipt.source,
    v_receipt.amount,
    v_receipt.occurred_on,
    v_receipt.notes,
    v_receipt.applied_to_balance,
    v_receipt.created_at,
    p.balance_known,
    p.current_balance
  from profiles p
  where p.id = p_profile_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_budget_horizon: an explicit "this money needs to last until <date>"
-- override. Highest-priority input to calculateHorizonDays in the engine.
-- ---------------------------------------------------------------------------
create or replace function set_budget_horizon(p_profile_id uuid, p_date date, p_note text)
returns setof profiles
language sql
as $$
  update profiles
  set budget_horizon_date = p_date,
      budget_horizon_note = p_note
  where id = p_profile_id
  returning *;
$$;

-- reset_demo_profile now also clears V2 tables/fields.
create or replace function reset_demo_profile(p_profile_id uuid)
returns void
language plpgsql
as $$
begin
  delete from transactions where profile_id = p_profile_id;
  delete from expenses where profile_id = p_profile_id;
  delete from incomes where profile_id = p_profile_id;
  delete from goals where profile_id = p_profile_id;
  delete from funding_awards where profile_id = p_profile_id;
  delete from income_receipts where profile_id = p_profile_id;

  update profiles
  set current_balance = 0,
      emergency_buffer = null,
      balance_known = false,
      balance_updated_at = null,
      budget_horizon_date = null,
      budget_horizon_note = null
  where id = p_profile_id;
end;
$$;

alter table funding_awards enable row level security;
alter table income_receipts enable row level security;
-- Intentionally no policies, matching every other table: only the
-- server-side service role key (bypasses RLS) may read or write.
