// Uceni Games admin API: question approval, flags, complaints and the figures NCC may request.
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3 });
const TOKEN_HOURS = 12;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-uceni-admin",
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

async function adminFrom(req: Request) {
  const token = req.headers.get("x-uceni-admin");
  if (!token) fail(401, "Please sign in.");
  const rows = await sql`select a.id, a.email, a.name from uceni.admin_tokens t join uceni.admins a on a.id = t.admin_id
                         where t.token_hash = ${await sha256(token!)} and t.expires_at > now()`;
  if (!rows.length) fail(401, "Your session has expired. Please sign in again.");
  return rows[0];
}

const SUBJECTS = ["maths", "english", "science", "history", "geography", "health", "tech", "gk"];
const STATUSES = ["draft", "approved", "rejected", "retired"];

function cleanQuestion(b: any) {
  const subject_id = String(b.subject_id ?? "");
  if (!SUBJECTS.includes(subject_id)) fail(400, "Choose a subject.");
  const level = ["beginner", "intermediate", "advanced"].includes(b.level) ? b.level : "beginner";
  const prompt = String(b.prompt ?? "").trim();
  const options = Array.isArray(b.options) ? b.options.map((o: unknown) => String(o ?? "").trim()) : [];
  const answer = Number(b.answer);
  const explanation = String(b.explanation ?? "").trim();
  if (prompt.length < 5) fail(400, "Write the question.");
  if (options.length !== 4 || options.some((o: string) => !o)) fail(400, "Fill in all four options.");
  if (new Set(options.map((o: string) => o.toLowerCase())).size !== 4) fail(400, "The four options must be different.");
  if (!(answer >= 0 && answer <= 3)) fail(400, "Pick the correct option.");
  if (explanation.length < 5) fail(400, "Add a short explanation.");
  return { subject_id, level, prompt, options, answer, explanation };
}

const actions: Record<string, (req: Request, body: any) => Promise<unknown>> = {
  async login(_req, body) {
    const email = String(body.email ?? "").trim().toLowerCase();
    const rows = await sql`select id, name, email from uceni.admins
                           where email = ${email} and password_hash = extensions.crypt(${String(body.password ?? "")}, password_hash)`;
    if (!rows.length) { await new Promise((r) => setTimeout(r, 800)); fail(401, "Email or password is not correct."); }
    const token = randomHex();
    await sql`insert into uceni.admin_tokens (token_hash, admin_id, expires_at)
              values (${await sha256(token)}, ${rows[0].id}, now() + ${TOKEN_HOURS + " hours"}::interval)`;
    return { token, admin: rows[0] };
  },

  async me(req) { return { admin: await adminFrom(req) }; },

  async sign_out(req) {
    const t = req.headers.get("x-uceni-admin");
    if (t) await sql`delete from uceni.admin_tokens where token_hash = ${await sha256(t)}`;
    return { ok: true };
  },

  async change_password(req, body) {
    const a = await adminFrom(req);
    const next = String(body.new_password ?? "");
    if (next.length < 10) fail(400, "Use at least 10 characters.");
    const ok = await sql`select 1 from uceni.admins where id = ${a.id} and password_hash = extensions.crypt(${String(body.current_password ?? "")}, password_hash)`;
    if (!ok.length) fail(400, "Your current password is not correct.");
    await sql`update uceni.admins set password_hash = extensions.crypt(${next}, extensions.gen_salt('bf')) where id = ${a.id}`;
    return { ok: true };
  },

  async stats(req) {
    await adminFrom(req);
    const [learners] = await sql`select count(*)::int as total,
      count(*) filter (where created_at > now() - interval '7 days')::int as new_7d,
      count(*) filter (where last_seen_at > now() - interval '1 day')::int as active_1d from uceni.learners`;
    const subs = await sql`select p.id, p.name, p.price,
      count(s.*) filter (where s.status = 'active' and s.expires_at > now())::int as active,
      count(s.*) filter (where s.status = 'cancelled' and s.expires_at > now())::int as cancelling
      from uceni.plans p left join uceni.subscriptions s on s.plan_id = p.id group by p.id order by p.sort`;
    const revenue = await sql`select p.id, p.name,
      coalesce(sum(c.amount) filter (where c.charged_at > (now() at time zone 'Africa/Lagos')::date at time zone 'Africa/Lagos'),0)::int as today,
      coalesce(sum(c.amount) filter (where c.charged_at > now() - interval '7 days'),0)::int as d7,
      coalesce(sum(c.amount) filter (where c.charged_at > now() - interval '30 days'),0)::int as d30,
      coalesce(sum(c.amount),0)::int as all_time,
      count(c.*)::int as charges
      from uceni.plans p left join uceni.charges c on c.plan_id = p.id and c.status = 'success' group by p.id order by p.sort`;
    const [sessions] = await sql`select count(*) filter (where status = 'completed')::int as completed,
      count(*) filter (where status = 'completed' and finished_at > now() - interval '7 days')::int as completed_7d,
      coalesce(round(avg(correct) filter (where status = 'completed'), 1), 0)::float as avg_correct from uceni.sessions`;
    const [cancels] = await sql`select count(*) filter (where cancelled_at > now() - interval '30 days')::int as d30 from uceni.subscriptions`;
    const questions = await sql`select s.id, s.name,
      count(q.*) filter (where q.status = 'approved')::int as approved,
      count(q.*) filter (where q.status = 'draft')::int as draft,
      count(q.*) filter (where q.status = 'rejected')::int as rejected
      from uceni.subjects s left join uceni.questions q on q.subject_id = s.id group by s.id order by s.sort`;
    const [openFlags] = await sql`select count(*)::int as n from uceni.flags where not resolved`;
    const [complaints] = await sql`select count(*) filter (where status = 'open')::int as open,
      count(*) filter (where created_at > now() - interval '30 days')::int as d30,
      coalesce(round(extract(epoch from avg(resolved_at - created_at) filter (where resolved_at is not null)) / 3600, 1), 0)::float as avg_hours
      from uceni.complaints`;
    return { learners, subscriptions: subs, revenue, sessions, cancellations_30d: cancels.d30, questions, open_flags: openFlags.n, complaints };
  },

  async questions(req, body) {
    await adminFrom(req);
    const status = STATUSES.includes(body.status) ? body.status : null;
    const subject = SUBJECTS.includes(body.subject_id) ? body.subject_id : null;
    const search = String(body.search ?? "").trim();
    const page = Math.max(0, Number(body.page) || 0);
    const rows = await sql`select id, subject_id, level, prompt, options, answer, explanation, status, flag_count, updated_at, approved_by
      from uceni.questions
      where (${status}::text is null or status = ${status})
        and (${subject}::text is null or subject_id = ${subject})
        and (${search} = '' or prompt ilike ${"%" + search + "%"})
      order by case status when 'draft' then 0 else 1 end, flag_count desc, updated_at desc
      limit 25 offset ${page * 25}`;
    const [count] = await sql`select count(*)::int as n from uceni.questions
      where (${status}::text is null or status = ${status})
        and (${subject}::text is null or subject_id = ${subject})
        and (${search} = '' or prompt ilike ${"%" + search + "%"})`;
    return { questions: rows, total: count.n, page, page_size: 25 };
  },

  async question_save(req, body) {
    const a = await adminFrom(req);
    const q = cleanQuestion(body);
    if (body.id) {
      const rows = await sql`update uceni.questions set subject_id = ${q.subject_id}, level = ${q.level}, prompt = ${q.prompt},
        options = ${sql.json(q.options)}, answer = ${q.answer}, explanation = ${q.explanation}, updated_at = now()
        where id = ${String(body.id)} returning id`;
      if (!rows.length) fail(404, "Question not found.");
      return { id: rows[0].id };
    }
    const status = body.approve ? "approved" : "draft";
    const rows = await sql`insert into uceni.questions (subject_id, level, prompt, options, answer, explanation, status, approved_at, approved_by)
      values (${q.subject_id}, ${q.level}, ${q.prompt}, ${sql.json(q.options)}, ${q.answer}, ${q.explanation}, ${status},
      ${status === "approved" ? new Date() : null}, ${status === "approved" ? a.email : null}) returning id`;
    return { id: rows[0].id };
  },

  async question_status(req, body) {
    const a = await adminFrom(req);
    const status = String(body.status);
    if (!STATUSES.includes(status)) fail(400, "Unknown status.");
    const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).map(String).slice(0, 200);
    await sql`update uceni.questions set status = ${status}, updated_at = now(),
      approved_at = case when ${status} = 'approved' then now() else approved_at end,
      approved_by = case when ${status} = 'approved' then ${a.email} else approved_by end
      where id = any(${sql.array(ids)}::uuid[])`;
    if (status === "approved" || status === "retired") {
      await sql`update uceni.flags set resolved = true where question_id = any(${sql.array(ids)}::uuid[]) and not resolved`;
      await sql`update uceni.questions set flag_count = 0 where id = any(${sql.array(ids)}::uuid[]) and ${status} = 'approved'`;
    }
    return { ok: true, updated: ids.length };
  },

  async flags(req) {
    await adminFrom(req);
    const rows = await sql`select f.id, f.reason, f.created_at, q.id as question_id, q.prompt, q.options, q.answer, q.explanation, q.subject_id, q.status
      from uceni.flags f join uceni.questions q on q.id = f.question_id where not f.resolved order by f.created_at desc limit 100`;
    return { flags: rows };
  },

  async flag_resolve(req, body) {
    await adminFrom(req);
    await sql`update uceni.flags set resolved = true where id = ${String(body.id)}`;
    return { ok: true };
  },

  async complaints(req, body) {
    await adminFrom(req);
    const status = body.status === "resolved" ? "resolved" : "open";
    return { complaints: await sql`select id, phone, channel, message, status, created_at, resolved_at from uceni.complaints
      where status = ${status} order by created_at desc limit 100` };
  },

  async complaint_resolve(req, body) {
    await adminFrom(req);
    await sql`update uceni.complaints set status = 'resolved', resolved_at = now() where id = ${String(body.id)}`;
    return { ok: true };
  },

  async learners(req, body) {
    await adminFrom(req);
    const search = String(body.search ?? "").replace(/\D/g, "");
    const page = Math.max(0, Number(body.page) || 0);
    const rows = await sql`select l.phone, l.display_name, l.total_points, l.sessions_completed, l.created_at, l.last_seen_at,
      s.plan_id, s.status as sub_status, s.expires_at
      from uceni.learners l
      left join lateral (select plan_id, status, expires_at from uceni.subscriptions where learner_id = l.id order by started_at desc limit 1) s on true
      where (${search} = '' or l.phone like ${"%" + search + "%"})
      order by l.created_at desc limit 50 offset ${page * 50}`;
    return { learners: rows, page };
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
