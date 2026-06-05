-- 024_payment_gateways.sql
-- Multi-gateway wallet purchases (Paystack, Fincra, …)

alter table public.transactions
  add column if not exists gateway text not null default 'paystack'
    check (gateway in ('paystack', 'fincra'));

create index if not exists transactions_gateway_reference_idx
  on public.transactions (gateway, reference);
