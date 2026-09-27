// Uceni Games learner API.
// Every learner action goes through here. Scoring, timing and subscription checks all happen on the server,
// so nothing a phone sends can inflate Knowledge Points.
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3 });

const GRACE_MS = 4000;            // allowance for slow networks
const SESSION_SIZE = 10;
const TOKEN_DAYS = 90;
// Until the aggregator or an SMS provider sends codes, OTP runs in test mode and the code is returned to the app.
const OTP_LIVE = Deno.env.get("UCENI_OTP_MODE") === "live";
// Progress ranks earned per subject. Difficulty levels (time and points per question) live in uceni.levels.
const RANKS: [string, number][] = [["Starter", 0], ["Achiever", 300], ["Expert", 800], ["Scholar", 1600]];
async function difficulty() {
  return await sql`select id, name, seconds, points_per_correct from uceni.levels order by sort`;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-uceni-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const fail = (status: number, message: string) => { throw new ApiError(status, message); };

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function randomHex(bytes = 32) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return Array.from(a).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function normalisePhone(raw: unknown) {
  let p = String(raw ?? "").replace(/[\s()+-]/g, "");
  if (p.startsWith("234")) p = "0" + p.slice(3);
  if (!/^0[789][01]\d{8}$/.test(p)) fail(400, "Enter an 11 digit Nigerian mobile number, for example 0803 123 4567.");
  return p;
}
function levelOf(points: number) {
  let i = 0; RANKS.forEach(([, t], k) => { if (points >= t) i = k; });
  return { name: RANKS[i][0], index: i, floor: RANKS[i][1], next: RANKS[i + 1]?.[1] ?? null, next_name: RANKS[i + 1]?.[0] ?? null };
}

async function learnerFrom(req: Request) {
  const token = req.headers.get("x-uceni-token");
  if (!token) fail(401, "Please sign in.");
  const rows = await sql`
    select l.* from uceni.learner_tokens t join uceni.learners l on l.id = t.learner_id
    where t.token_hash = ${await sha256(token!)} and t.expires_at > now()`;
  if (!rows.length) fail(401, "Your sign in has expired. Please sign in again.");
  await sql`update uceni.learners set last_seen_at = now() where id = ${rows[0].id}`;
  return rows[0];
}

// Returns the current subscription if the learner has access. Renewal is simulated here until the aggregator is connected.
async function access(learnerId: string) {
  const subs = await sql`
    select s.*, p.days, p.price, p.name as plan_name from uceni.subscriptions s join uceni.plans p on p.id = s.plan_id
    where s.learner_id = ${learnerId} and s.status in ('active','cancelled')
    order by s.expires_at desc limit 1`;
  if (!subs.length) return null;
  const s = subs[0];
  if (new Date(s.expires_at) > new Date()) return s;
  if (s.status === "cancelled") {
    await sql`update uceni.subscriptions set status = 'expired' where id = ${s.id}`;
    return null;
  }
  // Mock automatic renewal: one charge per elapsed period, capped.
  let expires = new Date(s.expires_at);
  let n = 0;
  while (expires <= new Date() && n < 31) { expires = new Date(expires.getTime() + s.days * 86400000); n++; }
  await sql.begin(async (tx) => {
    for (let i = 0; i < n; i++) {
      await tx`insert into uceni.charges (subscription_id, learner_id, plan_id, amount, kind)
               values (${s.id}, ${learnerId}, ${s.plan_id}, ${s.price}, 'renewal')`;
    }
    await tx`update uceni.subscriptions set expires_at = ${expires} where id = ${s.id}`;
  });
  return { ...s, expires_at: expires };
}

function subView(s: any) {
  if (!s) return null;
  return { plan_id: s.plan_id, plan_name: s.plan_name, price: s.price, status: s.status, expires_at: s.expires_at };
}

async function profile(l: any) {
  const sub = await access(l.id);
  const subjects = await sql`
    select s.id, s.name, coalesce(ls.points,0) as points, coalesce(ls.answered,0) as answered, coalesce(ls.correct,0) as correct
    from uceni.subjects s left join uceni.learner_subjects ls on ls.subject_id = s.id and ls.learner_id = ${l.id}
    where s.active order by s.sort`;
  const today = (await sql`select (now() at time zone 'Africa/Lagos')::date as d`)[0].d;
  const yest = new Date(new Date(today).getTime() - 86400000);
  const last = l.streak_last ? new Date(l.streak_last) : null;
  const streakLive = last && (last.getTime() === new Date(today).getTime() || last.getTime() === yest.getTime());
  return {
    phone: l.phone, display_name: l.display_name, hide_board: l.hide_board,
    total_points: l.total_points, streak: streakLive ? l.streak_count : 0, sessions: l.sessions_completed,
    subscription: subView(sub),
    subjects: subjects.map((s: any) => ({ ...s, level: levelOf(s.points) })),
    difficulty: await difficulty(),
  };
}

const actions: Record<string, (req: Request, body: any) => Promise<unknown>> = {
  async plans() {
    return { plans: await sql`select id, name, price, days, keyword from uceni.plans order by sort` };
  },

  async request_otp(_req, body) {
    const phone = normalisePhone(body.phone);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await sql`insert into uceni.otp_codes (phone, code_hash, expires_at, attempts)
              values (${phone}, ${await sha256(phone + code)}, now() + interval '10 minutes', 0)
              on conflict (phone) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, created_at = now()`;
    // In live mode the code is sent by SMS through the aggregator or SMS provider (to be connected).
    return OTP_LIVE ? { sent: true } : { sent: true, test_code: code };
  },

  async verify_otp(_req, body) {
    const phone = normalisePhone(body.phone);
    const rows = await sql`select * from uceni.otp_codes where phone = ${phone}`;
    if (!rows.length || new Date(rows[0].expires_at) < new Date()) fail(400, "That code has expired. Request a new one.");
    if (rows[0].attempts >= 5) fail(429, "Too many attempts. Request a new code.");
    if (rows[0].code_hash !== await sha256(phone + String(body.code ?? "").trim())) {
      await sql`update uceni.otp_codes set attempts = attempts + 1 where phone = ${phone}`;
      fail(400, "That code is not correct.");
    }
    await sql`delete from uceni.otp_codes where phone = ${phone}`;
    const name = String(body.display_name ?? "").trim().slice(0, 24);
    const learner = (await sql`
      insert into uceni.learners (phone, display_name) values (${phone}, ${name})
      on conflict (phone) do update set display_name = case when ${name} <> '' then ${name} else uceni.learners.display_name end
      returning *`)[0];
    const token = randomHex();
    await sql`insert into uceni.learner_tokens (token_hash, learner_id, expires_at)
              values (${await sha256(token)}, ${learner.id}, now() + ${TOKEN_DAYS + " days"}::interval)`;
    return { token, profile: await profile(learner) };
  },

  async me(req) { return { profile: await profile(await learnerFrom(req)) }; },

  async sign_out(req) {
    const token = req.headers.get("x-uceni-token");
    if (token) await sql`delete from uceni.learner_tokens where token_hash = ${await sha256(token)}`;
    return { ok: true };
  },

  // Mock consent and charge. When the aggregator is connected, this starts their consent flow instead,
  // and the subscription is created from their callback.
  async subscribe(req, body) {
    const l = await learnerFrom(req);
    const plan = (await sql`select * from uceni.plans where id = ${String(body.plan_id)}`)[0];
    if (!plan) fail(400, "Choose a plan.");
    const current = await access(l.id);
    await sql.begin(async (tx) => {
      if (current) await tx`update uceni.subscriptions set status = 'expired', expires_at = now() where id = ${current.id}`;
      const sub = (await tx`insert into uceni.subscriptions (learner_id, plan_id, status, channel, expires_at)
                            values (${l.id}, ${plan.id}, 'active', 'web', now() + ${plan.days + " days"}::interval) returning *`)[0];
      await tx`insert into uceni.charges (subscription_id, learner_id, plan_id, amount, kind)
               values (${sub.id}, ${l.id}, ${plan.id}, ${plan.price}, 'initial')`;
    });
    return { profile: await profile(l) };
  },

  async cancel(req) {
    const l = await learnerFrom(req);
    const s = await access(l.id);
    if (!s || s.status !== "active") fail(400, "You have no active plan to cancel.");
    await sql`update uceni.subscriptions set status = 'cancelled', cancelled_at = now() where id = ${s.id}`;
    return { profile: await profile(l) };
  },

  async start(req, body) {
    const l = await learnerFrom(req);
    if (!await access(l.id)) fail(402, "Choose a plan to start learning.");
    const subject = (await sql`select * from uceni.subjects where id = ${String(body.subject_id)} and active`)[0];
    if (!subject) fail(400, "Unknown subject.");
    const level = (await sql`select * from uceni.levels where id = ${String(body.level ?? "beginner")}`)[0];
    if (!level) fail(400, "Choose a difficulty level.");
    const qs = await sql`select id from uceni.questions where subject_id = ${subject.id} and level = ${level.id} and status = 'approved'
                         order by random() limit ${SESSION_SIZE}`;
    if (qs.length < 5) fail(409, "Questions at this level are being prepared. Try another level.");
    await sql`update uceni.sessions set status = 'abandoned' where learner_id = ${l.id} and status = 'active'`;
    const ids = qs.map((q: any) => q.id);
    const s = (await sql`insert into uceni.sessions (learner_id, subject_id, question_ids, level, question_seconds)
                         values (${l.id}, ${subject.id}, ${sql.array(ids)}::uuid[], ${level.id}, ${level.seconds}) returning id`)[0];
    return { session_id: s.id, subject: subject.name, level: level.name, total: ids.length,
             question_seconds: level.seconds, points_per_correct: level.points_per_correct };
  },

  // Serves the current question and starts its clock. Asking again does not reset the clock.
  async question(req, body) {
    const l = await learnerFrom(req);
    const s = (await sql`select * from uceni.sessions where id = ${String(body.session_id)} and learner_id = ${l.id}`)[0];
    if (!s || s.status !== "active") fail(400, "This session has ended.");
    if (s.current_index >= s.question_ids.length) return { done: true };
    let served = s.served_at;
    if (!served) served = (await sql`update uceni.sessions set served_at = now() where id = ${s.id} returning served_at`)[0].served_at;
    const q = (await sql`select id, prompt, options from uceni.questions where id = ${s.question_ids[s.current_index]}`)[0];
    const elapsed = Date.now() - new Date(served).getTime();
    return {
      index: s.current_index, total: s.question_ids.length, question_id: q.id, prompt: q.prompt, options: q.options,
      seconds_left: Math.max(0, s.question_seconds - Math.floor(elapsed / 1000)), question_seconds: s.question_seconds,
    };
  },

  async answer(req, body) {
    const l = await learnerFrom(req);
    return await sql.begin(async (tx) => {
      const s = (await tx`select * from uceni.sessions where id = ${String(body.session_id)} and learner_id = ${l.id} for update`)[0];
      if (!s || s.status !== "active") fail(400, "This session has ended.");
      if (!s.served_at) fail(400, "Load the question first.");
      if (Number(body.index) !== s.current_index) fail(409, "That question has already been answered.");
      const q = (await tx`select * from uceni.questions where id = ${s.question_ids[s.current_index]}`)[0];
      const elapsed = Date.now() - new Date(s.served_at).getTime();
      const timedOut = elapsed > s.question_seconds * 1000 + GRACE_MS;
      const raw = body.choice === null || body.choice === undefined ? null : Number(body.choice);
      const choice = timedOut || raw === null || !(raw >= 0 && raw <= 3) ? null : raw;
      const correct = choice !== null && choice === q.answer;
      const fast = correct && elapsed <= (s.question_seconds * 1000) / 2;
      await tx`insert into uceni.answers (session_id, idx, question_id, choice, is_correct, elapsed_ms)
               values (${s.id}, ${s.current_index}, ${q.id}, ${choice}, ${correct}, ${Math.min(elapsed, 2147483647)})`;
      await tx`update uceni.sessions set current_index = current_index + 1, served_at = null,
               correct = correct + ${correct ? 1 : 0}, fast = fast + ${fast ? 1 : 0} where id = ${s.id}`;
      return { correct, timed_out: timedOut || raw === null, answer: q.answer, explanation: q.explanation,
               is_last: s.current_index + 1 >= s.question_ids.length };
    });
  },

  async finish(req, body) {
    const l = await learnerFrom(req);
    return await sql.begin(async (tx) => {
      const s = (await tx`select * from uceni.sessions where id = ${String(body.session_id)} and learner_id = ${l.id} for update`)[0];
      if (!s || s.status !== "active") fail(400, "This session has ended.");
      if (s.current_index < s.question_ids.length) fail(400, "Answer every question first.");
      const me = (await tx`select * from uceni.learners where id = ${l.id} for update`)[0];
      const today = (await tx`select (now() at time zone 'Africa/Lagos')::date as d`)[0].d;
      const todayMs = new Date(today).getTime();
      const lastMs = me.streak_last ? new Date(me.streak_last).getTime() : null;
      let streakPts = 0, streak = me.streak_count;
      if (lastMs !== todayMs) { streak = lastMs === todayMs - 86400000 ? streak + 1 : 1; streakPts = 10; }
      const lvl = (await tx`select * from uceni.levels where id = ${s.level}`)[0];
      const base = s.correct * lvl.points_per_correct, bonus = s.fast * 5, done = 20;
      const subjectPts = base + bonus + done;
      const before = (await tx`select points from uceni.learner_subjects where learner_id = ${l.id} and subject_id = ${s.subject_id}`)[0]?.points ?? 0;
      await tx`insert into uceni.learner_subjects (learner_id, subject_id, points, answered, correct)
               values (${l.id}, ${s.subject_id}, ${subjectPts}, ${s.question_ids.length}, ${s.correct})
               on conflict (learner_id, subject_id) do update set points = learner_subjects.points + excluded.points,
               answered = learner_subjects.answered + excluded.answered, correct = learner_subjects.correct + excluded.correct`;
      await tx`update uceni.learners set total_points = total_points + ${subjectPts + streakPts}, streak_count = ${streak},
               streak_last = ${today}, sessions_completed = sessions_completed + 1 where id = ${l.id}`;
      await tx`update uceni.sessions set status = 'completed', finished_at = now(), points = ${subjectPts + streakPts} where id = ${s.id}`;
      const lb = levelOf(before), la = levelOf(before + subjectPts);
      return { correct: s.correct, total: s.question_ids.length, level: lvl.name, points_per_correct: lvl.points_per_correct,
               breakdown: { correct: base, quick: bonus, completed: done, streak: streakPts },
               points: subjectPts + streakPts, level_up: la.index > lb.index ? la.name : null };
    });
  },

  async review(req, body) {
    const l = await learnerFrom(req);
    const rows = await sql`
      select a.idx, a.choice, a.is_correct, q.prompt, q.options, q.answer, q.explanation, q.id as question_id
      from uceni.answers a join uceni.sessions s on s.id = a.session_id join uceni.questions q on q.id = a.question_id
      where a.session_id = ${String(body.session_id)} and s.learner_id = ${l.id} order by a.idx`;
    return { answers: rows };
  },

  async board(req) {
    const l = await learnerFrom(req);
    const top = await sql`select id, display_name, total_points from uceni.learners
                          where not hide_board and total_points > 0 order by total_points desc, created_at limit 20`;
    const rank = l.hide_board ? null :
      (await sql`select count(*)::int + 1 as r from uceni.learners where not hide_board and total_points > ${l.total_points}`)[0].r;
    return {
      top: top.map((r: any, i: number) => ({ rank: i + 1, name: r.display_name || "Learner", points: r.total_points, me: r.id === l.id })),
      me: { rank, points: l.total_points, hidden: l.hide_board },
    };
  },

  async settings(req, body) {
    const l = await learnerFrom(req);
    if (typeof body.hide_board === "boolean") await sql`update uceni.learners set hide_board = ${body.hide_board} where id = ${l.id}`;
    if (typeof body.display_name === "string") await sql`update uceni.learners set display_name = ${body.display_name.trim().slice(0, 24)} where id = ${l.id}`;
    return { profile: await profile((await sql`select * from uceni.learners where id = ${l.id}`)[0]) };
  },

  async flag(req, body) {
    const l = await learnerFrom(req);
    const q = (await sql`select id from uceni.questions where id = ${String(body.question_id)}`)[0];
    if (!q) fail(400, "Unknown question.");
    await sql`insert into uceni.flags (question_id, learner_id, reason) values (${q.id}, ${l.id}, ${String(body.reason ?? "").slice(0, 500)})`;
    await sql`update uceni.questions set flag_count = flag_count + 1 where id = ${q.id}`;
    return { ok: true };
  },

  async complaint(req, body) {
    const l = await learnerFrom(req);
    const msg = String(body.message ?? "").trim().slice(0, 2000);
    if (msg.length < 5) fail(400, "Tell us a little more so we can help.");
    await sql`insert into uceni.complaints (learner_id, phone, message) values (${l.id}, ${l.phone}, ${msg})`;
    return { ok: true };
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const fn = actions[String(body.action)];
    if (!fn) return json({ error: "Unknown action" }, 400);
    return json(await fn(req, body));
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
