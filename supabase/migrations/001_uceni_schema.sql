-- Uceni Games schema. Everything lives in its own schema so it never touches other products in this project.
-- The schema is not exposed through the REST API; all access goes through the uceni-api and uceni-admin edge functions.

create schema if not exists uceni;
revoke all on schema uceni from public, anon, authenticated;

create table uceni.subjects (
  id text primary key,
  name text not null,
  sort int not null default 0,
  active boolean not null default true
);

create table uceni.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references uceni.subjects(id),
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  answer smallint not null check (answer between 0 and 3),
  explanation text not null,
  status text not null default 'draft' check (status in ('draft','approved','rejected','retired')),
  flag_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text
);
create index on uceni.questions (subject_id, status);

create table uceni.plans (
  id text primary key,
  name text not null,
  price int not null,
  days int not null,
  keyword text not null,
  sort int not null default 0
);

create table uceni.learners (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  display_name text not null default '',
  hide_board boolean not null default false,
  total_points int not null default 0,
  streak_count int not null default 0,
  streak_last date,
  sessions_completed int not null default 0,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table uceni.learner_subjects (
  learner_id uuid not null references uceni.learners(id) on delete cascade,
  subject_id text not null references uceni.subjects(id),
  points int not null default 0,
  answered int not null default 0,
  correct int not null default 0,
  primary key (learner_id, subject_id)
);

create table uceni.otp_codes (
  phone text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create table uceni.learner_tokens (
  token_hash text primary key,
  learner_id uuid not null references uceni.learners(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table uceni.subscriptions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references uceni.learners(id) on delete cascade,
  plan_id text not null references uceni.plans(id),
  status text not null check (status in ('active','cancelled','expired')),
  channel text not null default 'web',
  consent_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  cancelled_at timestamptz
);
create index on uceni.subscriptions (learner_id, status);

create table uceni.charges (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references uceni.subscriptions(id) on delete cascade,
  learner_id uuid not null references uceni.learners(id) on delete cascade,
  plan_id text not null references uceni.plans(id),
  amount int not null,
  kind text not null check (kind in ('initial','renewal')),
  status text not null default 'success' check (status in ('success','failed','refunded')),
  provider text not null default 'mock',
  provider_ref text,
  charged_at timestamptz not null default now()
);
create index on uceni.charges (charged_at);

create table uceni.sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references uceni.learners(id) on delete cascade,
  subject_id text not null references uceni.subjects(id),
  question_ids uuid[] not null,
  current_index int not null default 0,
  served_at timestamptz,
  correct int not null default 0,
  fast int not null default 0,
  points int not null default 0,
  status text not null default 'active' check (status in ('active','completed','abandoned')),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on uceni.sessions (learner_id, started_at desc);

create table uceni.answers (
  session_id uuid not null references uceni.sessions(id) on delete cascade,
  idx int not null,
  question_id uuid not null references uceni.questions(id),
  choice smallint,
  is_correct boolean not null,
  elapsed_ms int not null,
  answered_at timestamptz not null default now(),
  primary key (session_id, idx)
);

create table uceni.flags (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references uceni.questions(id) on delete cascade,
  learner_id uuid references uceni.learners(id) on delete set null,
  reason text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table uceni.complaints (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references uceni.learners(id) on delete set null,
  phone text,
  channel text not null default 'web',
  message text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table uceni.admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table uceni.admin_tokens (
  token_hash text primary key,
  admin_id uuid not null references uceni.admins(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Lock everything down: no table is reachable from the public API roles.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'uceni' loop
    execute format('alter table uceni.%I enable row level security', t.tablename);
    execute format('revoke all on uceni.%I from public, anon, authenticated', t.tablename);
  end loop;
end $$;

-- Seed reference data
insert into uceni.subjects (id, name, sort) values
  ('maths','Mathematics',1),
  ('english','English Language',2),
  ('science','General Science',3),
  ('history','Nigerian History and Civic Education',4),
  ('geography','Geography',5),
  ('health','Health and Wellbeing',6),
  ('tech','Technology and Digital Skills',7),
  ('gk','General Knowledge',8);

insert into uceni.plans (id, name, price, days, keyword, sort) values
  ('daily','Daily',200,1,'UCENI DAY',1),
  ('weekly','Weekly',1000,7,'UCENI WEEK',2),
  ('monthly','Monthly',2000,30,'UCENI MONTH',3);
