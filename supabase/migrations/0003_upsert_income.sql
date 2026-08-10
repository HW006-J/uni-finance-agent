-- Incomes represent an expected/recurring payment pattern (like expenses),
-- not one row per individual deposit - so restating "my next Student
-- Finance payment is £3,000 in January" should update the existing
-- "Student Finance" row, not create a duplicate. Without this, a retried
-- or duplicated conversation (e.g. a transient AI-provider failure that a
-- client retries) silently double-counts income. Mirrors upsert_expense /
-- upsert_goal from 0001_schema.sql.

create unique index if not exists incomes_name_uidx on incomes (profile_id, lower(source));

create or replace function upsert_income(
  p_profile_id uuid,
  p_source text,
  p_amount numeric,
  p_date date,
  p_frequency text
)
returns setof incomes
language sql
as $$
  insert into incomes (profile_id, source, amount, date, frequency)
  values (p_profile_id, p_source, p_amount, p_date, p_frequency)
  on conflict (profile_id, (lower(source)))
  do update set
    amount = excluded.amount,
    date = excluded.date,
    frequency = excluded.frequency
  returning *;
$$;
