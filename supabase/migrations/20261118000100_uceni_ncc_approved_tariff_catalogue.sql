-- Uceni Games NCC tariff catalogue, 2 October 2026 approval.
-- Additive only: does not change uceni.plans, subscriptions, or any live billing flow.
-- Do NOT mark telco billing live until the subscriber-consent and operator callbacks are integrated.
create table if not exists uceni.approved_tariffs (
  tariff_code text primary key,
  display_name text not null,
  amount_ngn integer not null check (amount_ngn > 0),
  access_minutes integer not null check (access_minutes > 0),
  plan_type text not null check (plan_type in ('fixed_pass', 'subscription_or_on_demand')),
  renewal_requires_consent boolean not null default true check (renewal_requires_consent = true),
  free_trial_candidate boolean not null default false,
  available_for_sale boolean not null default false,
  shortcode text not null default '7995' check (shortcode = '7995'),
  source_reference text not null default 'NCC/PCEA/CT/2026/IBK/VENIX PARTNERS (2026-10-02)',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table uceni.approved_tariffs is
  'NCC-approved product catalogue only. available_for_sale=false until telco integration, consent and expiry verified. Not a charging authority.';

insert into uceni.approved_tariffs
  (tariff_code, display_name, amount_ngn, access_minutes, plan_type, free_trial_candidate)
values
  ('pass_4h', '4-hour access', 10, 240, 'fixed_pass', false),
  ('pass_8h', '8-hour access', 30, 480, 'fixed_pass', false),
  ('pass_12h', '12-hour access', 50, 720, 'fixed_pass', false),
  ('daily', 'Daily', 200, 1440, 'subscription_or_on_demand', true),
  ('weekly', 'Weekly', 1000, 10080, 'subscription_or_on_demand', true),
  ('monthly', 'Monthly', 2000, 43200, 'subscription_or_on_demand', true)
on conflict (tariff_code) do nothing;

-- The dedicated private schema is accessed by server-side functions only.
alter table uceni.approved_tariffs enable row level security;
revoke all on uceni.approved_tariffs from anon, authenticated;

-- This migration deliberately leaves all tariffs unavailable until
-- the production-safe consent, trial, billing and entitlement workflows are implemented.
