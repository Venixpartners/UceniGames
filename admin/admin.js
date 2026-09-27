(function(){
"use strict";
var C = window.UCENI_CONFIG, KEY = "uceni_admin_token";
var SUBJECTS = [["maths","Mathematics"],["english","English Language"],["science","General Science"],["history","Nigerian History and Civic Education"],["geography","Geography"],["health","Health and Wellbeing"],["tech","Technology and Digital Skills"],["gk","General Knowledge"]];
var SNAME = {}; SUBJECTS.forEach(function(s){ SNAME[s[0]] = s[1]; });
var app = document.getElementById("app");
var admin = null, tab = "overview";
var qf = {status:"draft", subject_id:"", search:"", page:0};

function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function naira(n){ return "₦" + Number(n||0).toLocaleString("en-NG"); }
function dt(t){ return t ? new Date(t).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : ""; }
function tok(){ try{ return localStorage.getItem(KEY); }catch(e){ return null; } }
function setTok(t){ try{ if(t) localStorage.setItem(KEY,t); else localStorage.removeItem(KEY); }catch(e){} }

function api(action, body){
  var h = {"Content-Type":"application/json","apikey":C.publishableKey}; var t = tok(); if(t) h["x-uceni-admin"] = t;
  return fetch(C.adminUrl,{method:"POST",headers:h,body:JSON.stringify(Object.assign({action:action},body||{}))})
    .then(function(r){ return r.json().catch(function(){return {};}).then(function(d){
      if(r.status===401 && action!=="login"){ setTok(null); admin=null; login(); throw new Error("Please sign in."); }
      if(!r.ok) throw new Error(d.error||"Something went wrong.");
      return d; }); });
}

function login(msg){
  app.innerHTML = '<div class="stack" style="max-width:26rem;margin-top:2rem"><h1>Sign in</h1>'+
    '<label class="field"><span>Email</span><input id="em" type="email" autocomplete="username"></label>'+
    '<label class="field"><span>Password</span><input id="pw" type="password" autocomplete="current-password"></label>'+
    '<p class="err" id="err">'+esc(msg||"")+'</p><button class="btn" data-act="login">Sign in</button></div>';
  document.getElementById("em").focus();
}

function shell(inner){
  var tabs = [["overview","Overview"],["questions","Questions"],["new","Add question"],["flags","Flags"],["complaints","Complaints"],["learners","Learners"],["settings","Settings"]];
  app.innerHTML = '<nav class="adnav">'+tabs.map(function(t){return '<button data-tab="'+t[0]+'"'+(t[0]===tab?' aria-current="page"':'')+'>'+t[1]+'</button>';}).join("")+'</nav><div id="body">'+inner+'</div>';
}
function body(html){ var b=document.getElementById("body"); if(b) b.innerHTML = html; }
function fail(e){ body('<p class="err">'+esc(e.message)+'</p>'); }

/* ---------- Overview ---------- */
function overview(){
  shell('<div class="loading">Loading</div>');
  api("stats").then(function(s){
    var activeSubs = s.subscriptions.reduce(function(a,x){return a+x.active+x.cancelling;},0);
    var rev30 = s.revenue.reduce(function(a,x){return a+x.d30;},0);
    body(
      '<h1>Overview</h1>'+
      (!C.billingLive?'<p class="notice" style="margin-top:1rem">Billing is in test mode. Revenue below comes from test subscriptions, not real charges.</p>':'')+
      '<div class="cards">'+
        '<div class="card"><b>'+s.learners.total+'</b>Learners</div>'+
        '<div class="card"><b>'+s.learners.new_7d+'</b>New in 7 days</div>'+
        '<div class="card"><b>'+activeSubs+'</b>Active subscriptions</div>'+
        '<div class="card"><b>'+naira(rev30)+'</b>Revenue, 30 days</div>'+
        '<div class="card"><b>'+s.sessions.completed_7d+'</b>Sessions, 7 days</div>'+
        '<div class="card"><b>'+s.open_flags+'</b>Open flags</div>'+
        '<div class="card"><b>'+s.complaints.open+'</b>Open complaints</div>'+
      '</div>'+
      '<h2>Subscriptions and revenue by plan</h2>'+
      '<div class="tbl"><table><thead><tr><th>Plan</th><th class="n">Price</th><th class="n">Active</th><th class="n">Cancelling</th><th class="n">Today</th><th class="n">7 days</th><th class="n">30 days</th><th class="n">All time</th><th class="n">Charges</th></tr></thead><tbody>'+
      s.subscriptions.map(function(p,i){ var r=s.revenue[i]; return '<tr><td>'+esc(p.name)+'</td><td class="n">'+naira(p.price)+'</td><td class="n">'+p.active+'</td><td class="n">'+p.cancelling+'</td><td class="n">'+naira(r.today)+'</td><td class="n">'+naira(r.d7)+'</td><td class="n">'+naira(r.d30)+'</td><td class="n">'+naira(r.all_time)+'</td><td class="n">'+r.charges+'</td></tr>'; }).join("")+
      '</tbody></table></div>'+
      '<h2>Service figures</h2>'+
      '<div class="tbl"><table><tbody>'+
        '<tr><td>Sessions completed, all time</td><td class="n">'+s.sessions.completed+'</td></tr>'+
        '<tr><td>Average correct answers per session</td><td class="n">'+s.sessions.avg_correct+' of 10</td></tr>'+
        '<tr><td>Cancellations, 30 days</td><td class="n">'+s.cancellations_30d+'</td></tr>'+
        '<tr><td>Complaints, 30 days</td><td class="n">'+s.complaints.d30+'</td></tr>'+
        '<tr><td>Average complaint resolution time</td><td class="n">'+s.complaints.avg_hours+' hours</td></tr>'+
        '<tr><td>Learners active in the last day</td><td class="n">'+s.learners.active_1d+'</td></tr>'+
      '</tbody></table></div>'+
      '<h2>Question bank</h2>'+
      '<div class="tbl"><table><thead><tr><th>Subject</th><th class="n">Approved</th><th class="n">Awaiting review</th><th class="n">Rejected</th></tr></thead><tbody>'+
      s.questions.map(function(q){ return '<tr><td>'+esc(q.name)+'</td><td class="n">'+q.approved+'</td><td class="n">'+q.draft+'</td><td class="n">'+q.rejected+'</td></tr>'; }).join("")+
      '</tbody></table></div>');
  }).catch(fail);
}

/* ---------- Questions ---------- */
function questions(){
  shell(
    '<h1>Questions</h1>'+
    '<div class="filters" style="margin-top:1rem">'+
      '<label>Status<br><select id="f_status"><option value="draft">Awaiting review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="retired">Retired</option><option value="">All</option></select></label>'+
      '<label>Subject<br><select id="f_subject"><option value="">All subjects</option>'+SUBJECTS.map(function(s){return '<option value="'+s[0]+'">'+s[1]+'</option>';}).join("")+'</select></label>'+
      '<label>Search<br><input id="f_search" type="search" placeholder="Words in the question"></label>'+
      '<button class="btn sm" data-act="filter">Show</button>'+
    '</div><div id="qlist"><div class="loading">Loading</div></div>');
  document.getElementById("f_status").value = qf.status;
  document.getElementById("f_subject").value = qf.subject_id;
  document.getElementById("f_search").value = qf.search;
  loadQuestions();
}
function loadQuestions(){
  api("questions",qf).then(function(d){
    var pages = Math.max(1,Math.ceil(d.total/d.page_size));
    var html = '<p>'+d.total+' question'+(d.total===1?"":"s")+'. Page '+(d.page+1)+' of '+pages+'.</p>';
    if(qf.status==="draft" && d.questions.length) html += '<div class="actions" style="margin-bottom:1rem"><button class="btn sm" data-act="approve_page">Approve all on this page</button></div>';
    html += d.questions.map(qItem).join("");
    html += '<div class="actions">'+(d.page>0?'<button class="btn sm alt" data-page="'+(d.page-1)+'">Previous</button>':'')+(d.page+1<pages?'<button class="btn sm alt" data-page="'+(d.page+1)+'">Next</button>':'')+'</div>';
    document.getElementById("qlist").innerHTML = html;
    document.getElementById("qlist").dataset.ids = JSON.stringify(d.questions.map(function(q){return q.id;}));
  }).catch(function(e){ document.getElementById("qlist").innerHTML='<p class="err">'+esc(e.message)+'</p>'; });
}
function qItem(q){
  var st = {draft:"Awaiting review",approved:"Approved",rejected:"Rejected",retired:"Retired"}[q.status];
  var act = [];
  if(q.status!=="approved") act.push('<button class="btn sm" data-status="approved" data-id="'+q.id+'">Approve</button>');
  if(q.status==="draft") act.push('<button class="btn sm alt" data-status="rejected" data-id="'+q.id+'">Reject</button>');
  if(q.status==="approved") act.push('<button class="btn sm alt" data-status="retired" data-id="'+q.id+'">Retire</button>');
  act.push('<button class="btn sm alt" data-edit="'+q.id+'">Edit</button>');
  return '<div class="qitem" id="q_'+q.id+'" data-q="'+esc(JSON.stringify(q))+'">'+
    '<div class="meta"><span class="pill">'+st+'</span><span>'+esc(SNAME[q.subject_id])+'</span><span>'+esc(q.level)+'</span>'+(q.flag_count?'<span class="err" style="margin:0">'+q.flag_count+' flag'+(q.flag_count>1?"s":"")+'</span>':'')+'</div>'+
    '<b>'+esc(q.prompt)+'</b>'+
    '<ol type="A">'+q.options.map(function(o,i){return '<li'+(i===q.answer?' class="ok"':'')+'>'+esc(o)+(i===q.answer?" (correct)":"")+'</li>';}).join("")+'</ol>'+
    '<p class="small">'+esc(q.explanation)+'</p>'+
    '<div class="actions">'+act.join("")+'</div></div>';
}

/* ---------- Add or edit ---------- */
function editor(q){
  q = q || {subject_id:"maths", level:"beginner", prompt:"", options:["","","",""], answer:0, explanation:""};
  var html = '<h1>'+(q.id?"Edit question":"Add a question")+'</h1><div class="stack" style="max-width:42rem;margin-top:1rem">'+
    '<div class="grid2"><label class="field"><span>Subject</span><select id="e_subject" class="field-sel">'+SUBJECTS.map(function(s){return '<option value="'+s[0]+'"'+(s[0]===q.subject_id?" selected":"")+'>'+s[1]+'</option>';}).join("")+'</select></label>'+
    '<label class="field"><span>Level</span><select id="e_level" class="field-sel">'+["beginner","intermediate","advanced"].map(function(l){return '<option value="'+l+'"'+(l===q.level?" selected":"")+'>'+l.charAt(0).toUpperCase()+l.slice(1)+'</option>';}).join("")+'</select></label></div>'+
    '<label class="field"><span>Question</span><textarea id="e_prompt" rows="2">'+esc(q.prompt)+'</textarea></label>'+
    [0,1,2,3].map(function(i){return '<div class="grid2" style="grid-template-columns:1fr auto;align-items:end"><label class="field"><span>Option '+"ABCD"[i]+'</span><input id="e_o'+i+'" value="'+esc(q.options[i])+'"></label><label style="padding-bottom:.8rem"><input type="radio" name="e_ans" value="'+i+'"'+(i===q.answer?" checked":"")+'> Correct</label></div>';}).join("")+
    '<label class="field"><span>Explanation shown after answering</span><textarea id="e_exp" rows="3">'+esc(q.explanation)+'</textarea></label>'+
    '<p class="err" id="err"></p>'+
    '<div class="actions">'+(q.id?'<button class="btn sm" data-act="save" data-id="'+q.id+'">Save changes</button>':'<button class="btn sm" data-act="save_approve">Save and approve</button><button class="btn sm alt" data-act="save">Save for review</button>')+
    '<button class="btn sm alt" data-tab="questions">Cancel</button></div></div>';
  shell(html);
}
function readEditor(){
  var ans = document.querySelector('input[name="e_ans"]:checked');
  return { subject_id:document.getElementById("e_subject").value, level:document.getElementById("e_level").value,
    prompt:document.getElementById("e_prompt").value, options:[0,1,2,3].map(function(i){return document.getElementById("e_o"+i).value;}),
    answer: ans ? +ans.value : -1, explanation:document.getElementById("e_exp").value };
}

/* ---------- Flags, complaints, learners, settings ---------- */
function flags(){
  shell('<h1>Flagged questions</h1><div id="fl"><div class="loading">Loading</div></div>');
  api("flags").then(function(d){
    document.getElementById("fl").innerHTML = d.flags.length ? d.flags.map(function(f){
      return '<div class="qitem"><div class="meta"><span>'+esc(SNAME[f.subject_id])+'</span><span>'+dt(f.created_at)+'</span></div>'+
        '<b>'+esc(f.prompt)+'</b><ol type="A">'+f.options.map(function(o,i){return '<li'+(i===f.answer?' class="ok"':'')+'>'+esc(o)+'</li>';}).join("")+'</ol>'+
        '<p><b>Learner said:</b> '+esc(f.reason||"No reason given")+'</p>'+
        '<div class="actions"><button class="btn sm alt" data-editid="'+f.question_id+'">Edit question</button><button class="btn sm alt" data-status="retired" data-id="'+f.question_id+'">Retire question</button><button class="btn sm alt" data-resolve="'+f.id+'">Question is fine</button></div></div>';
    }).join("") : '<p class="notice" style="margin-top:1rem">No open flags.</p>';
  }).catch(fail);
}
function complaints(status){
  status = status || "open";
  shell('<h1>Complaints</h1><div class="actions" style="margin:1rem 0"><button class="btn sm'+(status==="open"?"":" alt")+'" data-cstatus="open">Open</button><button class="btn sm'+(status==="resolved"?"":" alt")+'" data-cstatus="resolved">Resolved</button></div><div id="cl"><div class="loading">Loading</div></div>');
  api("complaints",{status:status}).then(function(d){
    document.getElementById("cl").innerHTML = d.complaints.length ? '<div class="tbl"><table><thead><tr><th>Received</th><th>Phone</th><th>Message</th><th></th></tr></thead><tbody>'+
      d.complaints.map(function(c){ return '<tr><td>'+dt(c.created_at)+'</td><td>'+esc(c.phone)+'</td><td>'+esc(c.message)+'</td><td>'+(c.status==="open"?'<button class="btn sm" data-cresolve="'+c.id+'">Mark resolved</button>':dt(c.resolved_at))+'</td></tr>'; }).join("")+
      '</tbody></table></div>' : '<p class="notice">Nothing here.</p>';
  }).catch(fail);
}
function learners(search){
  shell('<h1>Learners</h1><div class="filters" style="margin-top:1rem"><label>Phone<br><input id="l_search" type="search" value="'+esc(search||"")+'"></label><button class="btn sm" data-act="lsearch">Search</button></div><div id="ll"><div class="loading">Loading</div></div>');
  api("learners",{search:search||""}).then(function(d){
    document.getElementById("ll").innerHTML = d.learners.length ? '<div class="tbl"><table><thead><tr><th>Phone</th><th>Name</th><th class="n">Points</th><th class="n">Sessions</th><th>Plan</th><th>Status</th><th>Joined</th></tr></thead><tbody>'+
      d.learners.map(function(l){ return '<tr><td>'+esc(l.phone)+'</td><td>'+esc(l.display_name)+'</td><td class="n">'+l.total_points+'</td><td class="n">'+l.sessions_completed+'</td><td>'+esc(l.plan_id||"")+'</td><td>'+esc(l.sub_status||"none")+(l.expires_at?", until "+dt(l.expires_at):"")+'</td><td>'+dt(l.created_at)+'</td></tr>'; }).join("")+
      '</tbody></table></div>' : '<p class="notice">No learners yet.</p>';
  }).catch(fail);
}
function settings(){
  shell('<h1>Settings</h1><p>Signed in as '+esc(admin.email)+'.</p><div class="stack" style="max-width:26rem;margin-top:1rem"><h2>Change password</h2>'+
    '<label class="field"><span>Current password</span><input id="cp" type="password" autocomplete="current-password"></label>'+
    '<label class="field"><span>New password (at least 10 characters)</span><input id="np" type="password" autocomplete="new-password"></label>'+
    '<p class="err" id="err"></p><button class="btn" data-act="pw">Update password</button>'+
    '<button class="btn alt" data-act="signout">Sign out</button></div>');
}

function show(t, arg){
  tab = t;
  if(t==="overview") overview();
  else if(t==="questions") questions();
  else if(t==="new") editor(null);
  else if(t==="flags") flags();
  else if(t==="complaints") complaints(arg);
  else if(t==="learners") learners(arg);
  else if(t==="settings") settings();
}

document.addEventListener("click",function(e){
  var b = e.target.closest("button"); if(!b) return;
  var d = b.dataset, err = document.getElementById("err");
  if(d.tab){ show(d.tab); return; }
  if(d.act==="login"){
    b.disabled=true;
    api("login",{email:document.getElementById("em").value,password:document.getElementById("pw").value}).then(function(r){ setTok(r.token); admin=r.admin; show("overview"); })
      .catch(function(x){ b.disabled=false; err.textContent=x.message; });
    return;
  }
  if(d.act==="filter"){ qf.status=document.getElementById("f_status").value; qf.subject_id=document.getElementById("f_subject").value; qf.search=document.getElementById("f_search").value; qf.page=0; loadQuestions(); return; }
  if(d.page){ qf.page=+d.page; loadQuestions(); window.scrollTo(0,0); return; }
  if(d.status){
    b.disabled=true;
    api("question_status",{id:d.id,status:d.status}).then(function(){ if(tab==="flags") flags(); else loadQuestions(); }).catch(function(x){ b.disabled=false; alert(x.message); });
    return;
  }
  if(d.act==="approve_page"){
    if(!confirm("Approve every question on this page? Learners will start seeing them straight away.")) return;
    var ids = JSON.parse(document.getElementById("qlist").dataset.ids||"[]");
    b.disabled=true;
    api("question_status",{ids:ids,status:"approved"}).then(loadQuestions).catch(function(x){ b.disabled=false; alert(x.message); });
    return;
  }
  if(d.edit){ tab="questions"; editor(JSON.parse(document.getElementById("q_"+d.edit).dataset.q)); return; }
  if(d.editid){
    // Find the flagged question by its wording, then open it in the editor
    var card = b.closest(".qitem"), prompt = card.querySelector("b").textContent;
    api("questions",{search:prompt}).then(function(r){ var q=r.questions.filter(function(x){return x.id===d.editid;})[0]; if(q){ tab="questions"; editor(q); } });
    return;
  }
  if(d.act==="save"||d.act==="save_approve"){
    var q = readEditor(); if(d.id) q.id=d.id; if(d.act==="save_approve") q.approve=true;
    b.disabled=true;
    api("question_save",q).then(function(){ if(!d.id && tab==="new"){ editor(null); var e2=document.getElementById("err"); e2.style.color="var(--good)"; e2.textContent="Saved. Add the next question."; } else show("questions"); })
      .catch(function(x){ b.disabled=false; err.textContent=x.message; });
    return;
  }
  if(d.resolve){ api("flag_resolve",{id:d.resolve}).then(flags); return; }
  if(d.cstatus){ complaints(d.cstatus); return; }
  if(d.cresolve){ api("complaint_resolve",{id:d.cresolve}).then(function(){ complaints("open"); }); return; }
  if(d.act==="lsearch"){ learners(document.getElementById("l_search").value); return; }
  if(d.act==="pw"){
    b.disabled=true;
    api("change_password",{current_password:document.getElementById("cp").value,new_password:document.getElementById("np").value})
      .then(function(){ err.style.color="var(--good)"; err.textContent="Password updated."; b.disabled=false; })
      .catch(function(x){ b.disabled=false; err.textContent=x.message; });
    return;
  }
  if(d.act==="signout"){ api("sign_out").catch(function(){}).then(function(){ setTok(null); admin=null; login(); }); return; }
});

if(tok()) api("me").then(function(r){ admin=r.admin; show("overview"); }).catch(function(){ login(); });
else login();
})();
