-- Uceni Games: The Gamified Learning Experience
-- Cosmetic avatar + opt-in, non-monetary friend challenges. No payment tables touched.
alter table uceni.learners add column if not exists avatar text not null default 'brain';
alter table uceni.learners add constraint uceni_avatar_allowed check (avatar in ('brain','star','rocket','owl','lion','book','globe','lightning'));

create table if not exists uceni.friend_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references uceni.learners(id) on delete cascade,
  session_id uuid not null references uceni.sessions(id) on delete cascade,
  code text not null unique check (code ~ '^[a-f0-9]{24}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  constraint one_challenge_per_session unique(session_id)
);
create index if not exists uceni_friend_challenges_creator_idx on uceni.friend_challenges(creator_id);
alter table uceni.friend_challenges enable row level security;
revoke all on uceni.friend_challenges from anon, authenticated;
comment on table uceni.friend_challenges is 'Shareable 7-day educational challenges only; no stakes, prizes or monetary transfers.';
