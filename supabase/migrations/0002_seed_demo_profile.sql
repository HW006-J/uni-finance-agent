-- Creates the single demo profile row this MVP operates against. This is
-- infrastructure (an empty account), not seeded fake financial activity:
-- balance starts at 0 with no income, expenses, transactions or goals.
insert into profiles (id, currency, current_balance, emergency_buffer)
values ('00000000-0000-0000-0000-000000000001', 'GBP', 0, null)
on conflict (id) do nothing;
