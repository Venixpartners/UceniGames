-- Admin-only persistent throttling for Uceni Games.
-- Additive, limited to uceni.admins. No existing password or token is changed.
alter table uceni.admins
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists locked_until timestamptz;

alter table uceni.admins
  add constraint uceni_admins_failed_login_attempts_nonnegative check (failed_login_attempts >= 0);

comment on column uceni.admins.locked_until is
  'Temporary lockout after five failed admin password attempts; no unverified phone access.';

-- Keep admin credentials and lockout state behind the existing private schema.
alter table uceni.admins enable row level security;
revoke all on uceni.admins from anon, authenticated;
