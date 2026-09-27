-- Difficulty levels tie the time allowed per question to the points each correct answer earns.
create table uceni.levels (
  id text primary key,
  name text not null,
  seconds int not null,
  points_per_correct int not null,
  sort int not null
);
alter table uceni.levels enable row level security;
revoke all on uceni.levels from public, anon, authenticated;
insert into uceni.levels values
  ('beginner','Beginner',30,10,1),
  ('intermediate','Intermediate',20,15,2),
  ('advanced','Advanced',15,20,3);
alter table uceni.questions add constraint questions_level_fk foreign key (level) references uceni.levels(id);
alter table uceni.sessions add column level text not null default 'beginner' references uceni.levels(id);
alter table uceni.sessions add column question_seconds int not null default 30;
create index on uceni.questions (subject_id, level, status);
