-- Unlike incomes/expenses/goals, transactions are genuinely append-only
-- (the same merchant+amount CAN legitimately recur), so they can't be
-- protected with a simple unique index. But a client that gave up waiting
-- on a slow/rate-limited AI turn and got the user to resend the exact
-- same message shouldn't double-log the same purchase if the first
-- attempt's tool call actually completed server-side just after the
-- client stopped waiting. Guard against that narrow window: if an
-- identical transaction (same profile, merchant, amount, category) was
-- already logged in the last 10 seconds, return that existing row instead
-- of inserting - and don't touch the balance again.
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
  select * into v_txn
  from transactions
  where profile_id = p_profile_id
    and merchant = p_merchant
    and amount = p_amount
    and category = p_category
    and created_at > now() - interval '10 seconds'
  order by created_at desc
  limit 1;

  if found then
    return next v_txn;
    return;
  end if;

  insert into transactions (profile_id, merchant, amount, category, date, notes, source)
  values (p_profile_id, p_merchant, p_amount, p_category, coalesce(p_date, now()), p_notes, coalesce(p_source, 'chat'))
  returning * into v_txn;

  update profiles
  set current_balance = current_balance - p_amount
  where id = p_profile_id;

  return next v_txn;
end;
$$;
