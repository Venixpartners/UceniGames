(function(){
"use strict";
var C = window.UCENI_CONFIG;
var TOKEN_KEY = "uceni_token";

/* ---------- Helpers ---------- */
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function naira(n){ return "₦" + Number(n).toLocaleString("en-NG"); }
function fmtDate(t){ return new Date(t).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}); }
function getToken(){ try{ return localStorage.getItem(TOKEN_KEY); }catch(e){ return null; } }
function setToken(t){ try{ if(t) localStorage.setItem(TOKEN_KEY,t); else localStorage.removeItem(TOKEN_KEY); }catch(e){} }

function api(action, body){
  var headers = {"Content-Type":"application/json","apikey":C.publishableKey};
  var t = getToken(); if(t) headers["x-uceni-token"] = t;
  return fetch(C.apiUrl,{method:"POST",headers:headers,body:JSON.stringify(Object.assign({action:action},body||{}))})
    .then(function(r){ return r.json().catch(function(){return {};}).then(function(d){
      if(!r.ok){ var e=new Error(d.error||"Something went wrong. Please try again."); e.status=r.status; throw e; }
      return d;
    }); }, function(){ var e=new Error("We could not reach Uceni. Check your connection and try again."); e.status=0; throw e; });
}

var PER = {daily:"per day", weekly:"per week", monthly:"per month"};
var RENEW = {daily:"Renews daily until cancelled", weekly:"Renews weekly until cancelled", monthly:"Renews monthly until cancelled"};

/* ---------- State ---------- */
var P = null;              // learner profile from the server
var plans = [];
var chosenPlan = "weekly";
var chosenLevel = (function(){ try{ return localStorage.getItem("uceni_level") || "beginner"; }catch(e){ return "beginner"; } })();
var pendingSubject = null;
var pendingPhone = "", pendingName = "", testCode = null;
var sess = null, timerId = null;
var current = "";

var app = document.getElementById("app"), tabs = document.getElementById("tabs"), topbar = document.getElementById("topbar");
if(!C.billingLive) document.getElementById("banner").hidden = false;

function go(screen, arg){
  stopTimer();
  current = screen;
  app.innerHTML = SCREENS[screen](arg);
  var withTabs = ["home","progress","board","account"].indexOf(screen) > -1;
  tabs.hidden = !withTabs;
  topbar.hidden = screen === "welcome";
  Array.prototype.forEach.call(tabs.querySelectorAll("button"),function(b){
    if(b.dataset.go===screen) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current");
  });
  window.scrollTo(0,0);
  var f = app.querySelector("[data-autofocus]"); (f||app).focus({preventScroll:true});
  if(AFTER[screen]) AFTER[screen](arg);
}
function loading(msg){ app.innerHTML = '<div class="loading">'+esc(msg||"Loading")+'</div>'; }
function showError(err, retryScreen){
  if(err && err.status === 401){ setToken(null); P=null; go("welcome"); return; }
  app.innerHTML = '<div class="stack" style="margin-top:2rem"><h1>Something went wrong</h1><p>'+esc(err.message)+'</p>'+
    '<button class="btn" data-go="'+(retryScreen||"home")+'">Try again</button></div>';
  tabs.hidden = true;
}
function hasAccess(){ return !!(P && P.subscription); }

var SCREENS = {}, AFTER = {};

/* ---------- Welcome and sign in ---------- */
var TRY = ["What is the capital of Kwara State?",["Ilorin","Lokoja","Osogbo","Minna"],0,"Ilorin is the capital of Kwara State."];

SCREENS.welcome = function(){
  return '<div class="stack">'+
    '<img class="hero-logo logo-dark" src="/assets/uceni-wordmark.svg" alt="uceni">'+
    '<img class="hero-logo logo-light" src="/assets/uceni-wordmark-white.svg" alt="uceni">'+
    '<p class="tag">Learn. Think. Grow.</p>'+
    '<p>Short, timed questions in Maths, English, Science, History and more. See the right answer and why after every question, and watch your knowledge build day by day.</p>'+
    '<h2 style="margin-top:2rem">Try one now</h2>'+
    '<p class="q">'+esc(TRY[0])+'</p>'+
    '<ul class="opts">'+TRY[1].map(function(o,i){return '<li><button class="opt" data-try="'+i+'"><span class="bub">'+"ABCD"[i]+'</span><span>'+esc(o)+'</span></button></li>';}).join("")+'</ul>'+
    '<div id="tryfb" aria-live="polite"></div>'+
    '<div style="margin-top:2rem"><button class="btn" data-go="signup">Get started</button></div>'+
    '<p class="note">Plans from ₦200 per day. Knowledge Points show your learning progress only. They have no cash value and cannot be exchanged for money, airtime, data or gifts.</p>'+
    legalLinks()+
  '</div>';
};

function legalLinks(){
  return '<div class="links"><a href="/legal/terms.html">Terms of Service</a><a href="/legal/privacy.html">Privacy Notice</a><a href="/legal/policies.html">Service Policies</a></div>';
}

SCREENS.signup = function(){
  return '<div class="stack">'+
    '<button class="btn quiet" data-go="welcome">Back</button>'+
    '<h1>Your details</h1>'+
    '<p>Your subscription is linked to your phone number. We will send a code to confirm it.</p>'+
    '<label class="field"><span>Phone number</span><input id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 123 4567" value="'+esc(pendingPhone)+'" data-autofocus></label>'+
    '<label class="field"><span>Display name (optional)</span><input id="dname" type="text" maxlength="24" autocomplete="nickname" placeholder="Shown on the learning board" value="'+esc(pendingName)+'"></label>'+
    '<p class="err" id="err" aria-live="polite"></p>'+
    '<button class="btn" data-act="request_otp">Send code</button>'+
    '<p class="small">By continuing you agree to the <a href="/legal/terms.html">Terms of Service</a> and <a href="/legal/privacy.html">Privacy Notice</a>.</p>'+
  '</div>';
};

SCREENS.verify = function(){
  return '<div class="stack">'+
    '<button class="btn quiet" data-go="signup">Change number</button>'+
    '<h1>Enter your code</h1>'+
    '<p>We sent a 6 digit code to '+esc(pendingPhone)+'.</p>'+
    (testCode?'<div class="notice">Test mode: SMS is not connected yet, so your code is <b>'+esc(testCode)+'</b>.</div>':'')+
    '<label class="field"><span>Code</span><input id="code" class="code-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" data-autofocus></label>'+
    '<p class="err" id="err" aria-live="polite"></p>'+
    '<button class="btn" data-act="verify_otp">Confirm</button>'+
    '<button class="btn quiet" data-act="request_otp_again">Send a new code</button>'+
  '</div>';
};

/* ---------- Plans and consent ---------- */
SCREENS.plans = function(){
  return '<div class="stack">'+
    '<h1>Choose a plan</h1>'+
    '<p>Every plan gives unlimited learning sessions for its full period. Charges come from your airtime.</p>'+
    '<ul class="plans" role="radiogroup" aria-label="Plans">'+plans.map(function(p){
      return '<li><button class="plan" role="radio" aria-checked="'+(p.id===chosenPlan)+'" data-plan="'+p.id+'"><span class="bub"></span><span><b>'+esc(p.name)+'</b><br><span class="small">'+RENEW[p.id]+'</span></span><span class="pr">'+naira(p.price)+'</span></button></li>';}).join("")+'</ul>'+
    '<p class="small">Weekly saves ₦400 against seven daily payments. Monthly saves ₦4,000 against thirty.</p>'+
    '<button class="btn" data-go="confirm">Continue</button>'+
    (P && P.subscription ? '<button class="btn alt" data-go="account">Keep my current plan</button>' : '')+
  '</div>';
};

SCREENS.confirm = function(){
  var p = plans.filter(function(x){return x.id===chosenPlan;})[0];
  return '<div class="stack"><div class="sheet stack">'+
    '<h1>Confirm your subscription</h1>'+
    '<dl class="kv">'+
      '<div><dt>Service</dt><dd>Uceni Games '+esc(p.name)+'</dd></div>'+
      '<div><dt>Price</dt><dd>'+naira(p.price)+' '+PER[p.id]+'</dd></div>'+
      '<div><dt>Charged to</dt><dd>'+esc(P.phone)+'</dd></div>'+
      '<div><dt>Renewal</dt><dd>'+RENEW[p.id]+'</dd></div>'+
    '</dl>'+
    '<p class="small">To cancel at any time, send STOP UCENI to '+C.shortcode+'. Knowledge Points have no cash value and no prizes are offered.</p>'+
    (P.subscription?'<p class="small">Your current plan will end and this plan will start now.</p>':'')+
    '<p class="err" id="err" aria-live="polite"></p>'+
    '<button class="btn" data-act="subscribe" data-autofocus>Confirm and pay '+naira(p.price)+'</button>'+
    '<button class="btn alt" data-go="plans">Go back</button>'+
  '</div></div>';
};

SCREENS.subscribed = function(){
  var s = P.subscription;
  return '<div class="stack">'+
    '<h1>You are subscribed</h1>'+
    '<p>This is the welcome message you will receive from '+C.shortcode+':</p>'+
    '<div class="sms">Welcome to Uceni Games '+esc(s.plan_name)+'. '+naira(s.price)+' '+PER[s.plan_id]+', '+RENEW[s.plan_id].toLowerCase()+'. Send STOP UCENI to '+C.shortcode+' to cancel or HELP UCENI for support.</div>'+
    '<button class="btn" data-go="home" data-autofocus>Start learning</button>'+
  '</div>';
};

/* ---------- Home ---------- */
function greet(){ var h=new Date().getHours(); return h<12?"Good morning":h<17?"Good afternoon":"Good evening"; }
SCREENS.home = function(){
  var nm = P.display_name ? ", "+esc(P.display_name) : "";
  return '<h1>'+greet()+nm+'</h1>'+
    '<div class="stats"><div><b>'+P.total_points.toLocaleString()+'</b>Knowledge Points</div><div><b>'+P.streak+'</b>day streak</div><div><b>'+P.sessions+'</b>sessions</div></div>'+
    (!hasAccess()?'<div class="notice" style="margin-top:1.25rem">Your plan has ended. <button class="btn quiet" data-go="plans">Choose a plan</button> to keep learning.</div>':'')+
    '<h2 style="margin-top:2rem">Pick a subject</h2>'+
    '<ul class="ruled">'+P.subjects.map(function(s){
      return '<li><button data-start="'+esc(s.id)+'"><span class="nm">'+esc(s.name)+'</span><span class="lv">'+esc(s.level.name)+'</span></button></li>';}).join("")+'</ul>'+
    '<p class="small" style="margin-top:1rem">Each session is 10 questions. You choose the level: the harder it is, the less time you get and the more points each correct answer earns.</p>';
};

/* ---------- Difficulty ---------- */
SCREENS.difficulty = function(){
  var subj = P.subjects.filter(function(s){ return s.id===pendingSubject; })[0];
  return '<div class="stack">'+
    '<button class="btn quiet" data-go="home">Back to subjects</button>'+
    '<h1>'+esc(subj?subj.name:"Choose a level")+'</h1>'+
    '<p>Choose your level. Harder levels give you less time per question and more points for each correct answer.</p>'+
    '<ul class="plans" role="radiogroup" aria-label="Difficulty level">'+P.difficulty.map(function(d){
      return '<li><button class="plan" role="radio" aria-checked="'+(d.id===chosenLevel)+'" data-level="'+esc(d.id)+'"><span class="bub"></span>'+
        '<span><b>'+esc(d.name)+'</b><br><span class="small">'+d.seconds+' seconds per question</span></span>'+
        '<span class="pr">'+d.points_per_correct+' pts</span></button></li>';}).join("")+'</ul>'+
    '<p class="small">Points shown are for each correct answer. Answer within the first half of the time for a 5 point quick answer bonus.</p>'+
    '<button class="btn" data-act="begin" data-autofocus>Start 10 questions</button>'+
  '</div>';
};

/* ---------- Session ---------- */
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }

function startSession(subjectId, level){
  if(!hasAccess()){ goTo("plans"); return; }
  level = level || chosenLevel;
  loading("Preparing your questions");
  api("start",{subject_id:subjectId, level:level}).then(function(d){
    sess = {id:d.session_id, subjectId:subjectId, levelId:level, levelName:d.level, subject:d.subject, total:d.total, seconds:d.question_seconds, locked:false, q:null};
    loadQuestion();
  }).catch(function(e){ if(e.status===402){ refreshProfile().then(function(){ go("plans"); }); } else showError(e,"home"); });
}

function loadQuestion(){
  loading();
  api("question",{session_id:sess.id}).then(function(q){
    if(q.done){ finish(); return; }
    sess.q = q; sess.locked = false; if(q.question_seconds) sess.seconds = q.question_seconds;
    go("session");
  }).catch(function(e){ showError(e,"home"); });
}

SCREENS.session = function(){
  var q = sess.q;
  return '<div class="qhead"><span>'+esc(sess.subject)+', '+esc(sess.levelName)+'</span><span>Question '+(q.index+1)+' of '+q.total+'</span></div>'+
    '<div class="timer" id="tbar" role="progressbar" aria-label="Time left" aria-valuemin="0" aria-valuemax="'+sess.seconds+'" aria-valuenow="'+q.seconds_left+'"><i id="tfill"></i></div>'+
    '<p class="q">'+esc(q.prompt)+'</p>'+
    '<ul class="opts">'+q.options.map(function(o,i){return '<li><button class="opt" data-ans="'+i+'" aria-label="'+"ABCD"[i]+': '+esc(o)+'"><span class="bub" aria-hidden="true">'+"ABCD"[i]+'</span><span>'+esc(o)+'</span></button></li>';}).join("")+'</ul>'+
    '<div id="fb" aria-live="polite"></div>'+
    '<p style="margin-top:1.5rem"><button class="btn quiet" data-act="quit">End session</button></p>';
};
AFTER.session = function(){
  var q = sess.q, fill = document.getElementById("tfill"), bar = document.getElementById("tbar");
  var endAt = Date.now() + q.seconds_left*1000;
  function tick(){
    var left = Math.max(0,(endAt-Date.now())/1000);
    fill.style.width = (left/sess.seconds*100)+"%";
    bar.setAttribute("aria-valuenow",Math.ceil(left));
    if(left<=5) bar.classList.add("low");
    if(left<=0) answer(null);
  }
  tick(); timerId = setInterval(tick,100);
  var first = app.querySelector("[data-ans]"); if(first) first.focus({preventScroll:true});
};

function answer(k){
  if(!sess || sess.locked) return;
  sess.locked = true; stopTimer();
  var btns = app.querySelectorAll("[data-ans]");
  Array.prototype.forEach.call(btns,function(b,i){ b.disabled=true; if(i===k) b.classList.add("chosen"); });
  api("answer",{session_id:sess.id, index:sess.q.index, choice:k}).then(function(r){
    Array.prototype.forEach.call(btns,function(b,i){
      b.classList.remove("chosen");
      if(i===r.answer) b.classList.add("right");
      else if(i===k) b.classList.add("wrong");
      else b.classList.add("fade");
    });
    var L = "ABCD"[r.answer];
    var head = r.correct ? "Correct." : (k===null || r.timed_out ? "Time is up. The answer is "+L+"." : "Not quite. The answer is "+L+".");
    sess.last = r.is_last;
    document.getElementById("fb").innerHTML = '<div class="fb '+(r.correct?"good":"bad")+'"><strong>'+head+'</strong>'+esc(r.explanation)+'</div>'+
      '<div style="margin-top:1rem"><button class="btn" data-act="next">'+(r.is_last?"See results":"Next question")+'</button></div>'+
      '<p class="small" style="margin-top:.75rem"><button class="btn quiet" data-act="flag" data-q="'+esc(sess.q.question_id)+'">Report a problem with this question</button></p>';
    app.querySelector('[data-act="next"]').focus({preventScroll:false});
  }).catch(function(e){
    if(e.status===409){ loadQuestion(); return; }
    showError(e,"home");
  });
}

function finish(){
  loading("Adding up your points");
  api("finish",{session_id:sess.id}).then(function(r){
    r.subject = sess.subject; r.subject_id = sess.subjectId; r.level_id = sess.levelId; r.session_id = sess.id;
    sess = null;
    return refreshProfile().then(function(){ go("results",r); });
  }).catch(function(e){ showError(e,"home"); });
}

SCREENS.results = function(r){
  var b = r.breakdown;
  return '<div class="stack">'+
    '<p>'+esc(r.subject)+', '+esc(r.level)+' level</p>'+
    '<p class="big">'+r.correct+' of '+r.total+'</p>'+
    '<p>'+(r.correct>=8?"Excellent work. You clearly know this area well.":r.correct>=5?"Good effort. Review the explanations and try again to lift your score.":"Keep practising. Each session adds to what you know.")+'</p>'+
    (r.level_up?'<div class="fb good"><strong>New rank reached</strong>You are now '+esc(r.level_up)+' in '+esc(r.subject)+'.</div>':'')+
    '<dl class="kv">'+
      '<div><dt>Correct answers ('+r.points_per_correct+' each)</dt><dd>'+b.correct+'</dd></div>'+
      '<div><dt>Quick answer bonus</dt><dd>'+b.quick+'</dd></div>'+
      '<div><dt>Session completed</dt><dd>'+b.completed+'</dd></div>'+
      (b.streak?'<div><dt>Daily streak</dt><dd>'+b.streak+'</dd></div>':'')+
      '<div><dt>Knowledge Points earned</dt><dd>'+r.points+'</dd></div>'+
    '</dl>'+
    '<div class="row" style="margin-top:1.5rem"><button class="btn" data-again="'+esc(r.subject_id)+'" data-lv="'+esc(r.level_id)+'" data-autofocus>Practise again</button><button class="btn alt" data-go="home">Subjects</button></div>'+
    '<button class="btn quiet" data-review="'+esc(r.session_id)+'">Review my answers</button>'+
  '</div>';
};

SCREENS.review = function(rows){
  return '<div class="stack"><button class="btn quiet" data-go="home">Back to subjects</button><h1>Your answers</h1>'+
    '<ol class="review">'+rows.map(function(a){
      var ok=a.is_correct;
      return '<li><div class="mk '+(ok?"good":"bad")+'">'+(ok?"Correct":"Incorrect")+'</div><p><b>'+esc(a.prompt)+'</b></p>'+
        '<p class="small">Your answer: '+(a.choice===null?"No answer":"ABCD"[a.choice]+". "+esc(a.options[a.choice]))+'<br>Correct answer: '+"ABCD"[a.answer]+". "+esc(a.options[a.answer])+'</p>'+
        '<p class="small">'+esc(a.explanation)+'</p></li>';}).join("")+'</ol></div>';
};

/* ---------- Progress, board, account ---------- */
SCREENS.progress = function(){
  var weak = [];
  var rows = P.subjects.map(function(s){
    var l = s.level, acc = s.answered ? Math.round(s.correct/s.answered*100) : null;
    if(acc!==null && s.answered>=10 && acc<60) weak.push(s.name);
    var pct = l.next ? Math.round((s.points-l.floor)/(l.next-l.floor)*100) : 100;
    return '<div class="subj"><div class="top"><b>'+esc(s.name)+'</b><span>Rank: '+esc(l.name)+'</span></div>'+
      '<div class="small">'+(s.answered? s.answered+' answered, '+acc+'% correct, '+s.points+' points':'Not started yet')+
      (l.next? ', '+(l.next-s.points)+' points to '+l.next_name : '')+'</div>'+
      '<div class="bar" role="progressbar" aria-label="Progress to next rank" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><i style="width:'+pct+'%"></i></div></div>';
  }).join("");
  return '<h1>Your progress</h1>'+
    '<div class="stats"><div><b>'+P.total_points.toLocaleString()+'</b>Knowledge Points</div><div><b>'+P.sessions+'</b>sessions</div><div><b>'+P.streak+'</b>day streak</div></div>'+
    (weak.length?'<div class="fb bad" style="margin-top:1.25rem"><strong>Worth more practice</strong>'+esc(weak.join(", "))+'</div>':'')+
    '<div style="margin-top:1rem">'+rows+'</div>';
};

SCREENS.board = function(d){
  if(!d) return '<div class="loading">Loading</div>';
  var inTop = d.top.some(function(x){return x.me;});
  return '<h1>Learning board</h1>'+
    '<p>See how your progress compares with other learners. The board is for motivation only and carries no reward of any kind.</p>'+
    (d.top.length?'<ol class="board">'+d.top.map(function(x){return '<li'+(x.me?' class="me"':'')+'><span class="rk">'+x.rank+'</span><span>'+esc(x.name)+(x.me?" (you)":"")+'</span><span class="pt">'+x.points.toLocaleString()+'</span></li>';}).join("")+'</ol>'
      :'<p class="notice">No one is on the board yet. Complete a session to be the first.</p>')+
    (!inTop && !d.me.hidden && d.me.points>0?'<p style="margin-top:1rem">Your position: <b>'+d.me.rank+'</b> with '+d.me.points.toLocaleString()+' points.</p>':'')+
    (d.me.hidden?'<p class="small" style="margin-top:1rem">You are hidden from the board. Change this in Account.</p>':'');
};

SCREENS.account = function(){
  var s = P.subscription;
  var status = !s ? "No active plan" : s.status==="cancelled" ? "Cancelled, access until "+fmtDate(s.expires_at) : "Active, renews "+fmtDate(s.expires_at);
  return '<h1>Account</h1>'+
    '<dl class="kv">'+
      '<div><dt>Phone</dt><dd>'+esc(P.phone)+'</dd></div>'+
      '<div><dt>Plan</dt><dd>'+(s?esc(s.plan_name)+", "+naira(s.price)+" "+PER[s.plan_id]:"None")+'</dd></div>'+
      '<div><dt>Status</dt><dd>'+status+'</dd></div>'+
    '</dl>'+
    '<label class="field" style="margin-top:1.25rem"><span>Display name</span><input id="dname2" type="text" maxlength="24" value="'+esc(P.display_name)+'"></label>'+
    '<button class="btn alt" style="margin-top:.6rem" data-act="save_name">Save name</button>'+
    '<div class="toggle" style="margin-top:.75rem"><span>Hide me from the learning board</span><button class="sw" role="switch" aria-checked="'+P.hide_board+'" aria-label="Hide me from the learning board" data-act="hide"></button></div>'+
    '<div class="stack" style="margin-top:1.5rem">'+
      '<button class="btn alt" data-go="plans">'+(s?"Change plan":"Choose a plan")+'</button>'+
      (s&&s.status==="active"?'<button class="btn alt" data-act="cancel">Unsubscribe</button>':'')+
    '</div>'+
    '<h2 style="margin-top:2rem">Help</h2>'+
    '<p>Send HELP UCENI to '+C.shortcode+' for service and support details. Send STOP UCENI or STOP to '+C.shortcode+' to cancel at any time.</p>'+
    '<label class="field"><span>Contact support</span><textarea id="complaint" rows="3" placeholder="Tell us what went wrong"></textarea></label>'+
    '<p class="err" id="err" aria-live="polite"></p>'+
    '<button class="btn alt" data-act="complaint">Send message</button>'+
    '<p class="note">Knowledge Points measure learning progress only. They have no monetary value and cannot be redeemed, exchanged or transferred for cash, airtime, data, goods or any other reward. Uceni Games offers no prizes or rewards of any kind.</p>'+
    legalLinks()+
    '<button class="btn quiet" style="margin-top:1rem" data-act="sign_out">Sign out</button>';
};

SCREENS.cancelled = function(){
  return '<div class="stack"><h1>Subscription cancelled</h1>'+
    '<div class="sms">You have unsubscribed from Uceni Games. No further charges will be made. Your access continues until '+fmtDate(P.subscription.expires_at)+'.</div>'+
    '<button class="btn" data-go="account" data-autofocus>Done</button></div>';
};

/* ---------- Data loading ---------- */
function refreshProfile(){ return api("me").then(function(d){ P = d.profile; return P; }); }
function loadPlans(){ return plans.length ? Promise.resolve(plans) : api("plans").then(function(d){ plans = d.plans; return plans; }); }

function goTo(screen){
  if(screen==="board"){ go("board",null); api("board").then(function(d){ if(current==="board") go("board",d); }).catch(function(e){ showError(e,"board"); }); return; }
  if(screen==="plans"||screen==="confirm"){ loadPlans().then(function(){ go(screen); }).catch(function(e){ showError(e,"home"); }); return; }
  if(screen==="signup"||screen==="welcome"){ go(screen); return; }
  if(!P){ go("welcome"); return; }
  go(screen);
}

/* ---------- Events ---------- */
function setErr(m){ var e=document.getElementById("err"); if(e) e.textContent=m||""; }
function busy(btn,on){ if(btn){ btn.disabled=on; } }

document.addEventListener("click",function(e){
  var t = e.target.closest("button"); if(!t) return;
  if(t.dataset.go){ goTo(t.dataset.go); return; }
  if(t.dataset.start){ if(!hasAccess()){ goTo("plans"); return; } pendingSubject=t.dataset.start; go("difficulty"); return; }
  if(t.dataset.again){ startSession(t.dataset.again, t.dataset.lv); return; }
  if(t.dataset.level){ chosenLevel=t.dataset.level; try{ localStorage.setItem("uceni_level",chosenLevel); }catch(err){} Array.prototype.forEach.call(app.querySelectorAll("[data-level]"),function(b){b.setAttribute("aria-checked",b.dataset.level===chosenLevel);}); return; }
  if(t.dataset.review){ loading(); api("review",{session_id:t.dataset.review}).then(function(d){ go("review",d.answers); }).catch(function(err){ showError(err,"home"); }); return; }
  if(t.dataset.ans!==undefined){ answer(+t.dataset.ans); return; }
  if(t.dataset.plan){ chosenPlan=t.dataset.plan; Array.prototype.forEach.call(app.querySelectorAll("[data-plan]"),function(b){b.setAttribute("aria-checked",b.dataset.plan===chosenPlan);}); return; }
  if(t.dataset.try!==undefined){
    var k=+t.dataset.try;
    Array.prototype.forEach.call(document.querySelectorAll("[data-try]"),function(b,i){ b.disabled=true; if(i===TRY[2]) b.classList.add("right"); else if(i===k) b.classList.add("wrong"); else b.classList.add("fade"); });
    document.getElementById("tryfb").innerHTML='<div class="fb '+(k===TRY[2]?"good":"bad")+'"><strong>'+(k===TRY[2]?"Correct.":"Not quite. The answer is A.")+'</strong>'+esc(TRY[3])+'</div>';
    return;
  }
  var a = t.dataset.act;
  if(a==="request_otp"||a==="request_otp_again"){
    if(a==="request_otp"){ pendingPhone=document.getElementById("phone").value; pendingName=document.getElementById("dname").value; }
    busy(t,true); setErr("");
    api("request_otp",{phone:pendingPhone}).then(function(d){ testCode=d.test_code||null; go("verify"); })
      .catch(function(err){ busy(t,false); setErr(err.message); });
    return;
  }
  if(a==="verify_otp"){
    busy(t,true); setErr("");
    api("verify_otp",{phone:pendingPhone, code:document.getElementById("code").value, display_name:pendingName}).then(function(d){
      setToken(d.token); P=d.profile; testCode=null;
      if(hasAccess()) go("home"); else goTo("plans");
    }).catch(function(err){ busy(t,false); setErr(err.message); });
    return;
  }
  if(a==="subscribe"){
    busy(t,true); setErr("");
    api("subscribe",{plan_id:chosenPlan}).then(function(d){ P=d.profile; go("subscribed"); })
      .catch(function(err){ busy(t,false); setErr(err.message); });
    return;
  }
  if(a==="begin"){ startSession(pendingSubject, chosenLevel); return; }
  if(a==="next"){ if(sess.last) finish(); else loadQuestion(); return; }
  if(a==="quit"){ if(confirm("End this session? Points from this session will not be saved.")){ sess=null; stopTimer(); go("home"); } return; }
  if(a==="flag"){
    var reason = prompt("What is wrong with this question? For example, the answer is wrong or the wording is unclear.");
    if(reason===null) return;
    api("flag",{question_id:t.dataset.q, reason:reason}).then(function(){ t.outerHTML='<span class="small">Thank you. We will review this question.</span>'; }).catch(function(){});
    return;
  }
  if(a==="hide"){
    var next = !P.hide_board; t.setAttribute("aria-checked",next);
    api("settings",{hide_board:next}).then(function(d){ P=d.profile; }).catch(function(err){ t.setAttribute("aria-checked",!next); alert(err.message); });
    return;
  }
  if(a==="save_name"){
    busy(t,true);
    api("settings",{display_name:document.getElementById("dname2").value}).then(function(d){ P=d.profile; t.textContent="Saved"; setTimeout(function(){ t.textContent="Save name"; busy(t,false); },1500); })
      .catch(function(err){ busy(t,false); alert(err.message); });
    return;
  }
  if(a==="cancel"){
    if(!confirm("Unsubscribe from Uceni Games? No further charges will be made.")) return;
    api("cancel").then(function(d){ P=d.profile; go("cancelled"); }).catch(function(err){ alert(err.message); });
    return;
  }
  if(a==="complaint"){
    busy(t,true); setErr("");
    api("complaint",{message:document.getElementById("complaint").value}).then(function(){ document.getElementById("complaint").value=""; t.textContent="Message sent. We will reply within 24 hours."; })
      .catch(function(err){ busy(t,false); setErr(err.message); });
    return;
  }
  if(a==="sign_out"){ api("sign_out").catch(function(){}).then(function(){ setToken(null); P=null; go("welcome"); }); return; }
});

document.addEventListener("keydown",function(e){
  if(current!=="session"||!sess||sess.locked) return;
  if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
  var m = {"1":0,"2":1,"3":2,"4":3,"a":0,"b":1,"c":2,"d":3}[e.key.toLowerCase()];
  if(m!==undefined){ e.preventDefault(); answer(m); }
});

/* ---------- Start ---------- */
if(getToken()){
  refreshProfile().then(function(){ if(hasAccess()) go("home"); else goTo("plans"); })
    .catch(function(e){ if(e.status===401){ setToken(null); go("welcome"); } else showError(e,"home"); });
} else {
  go("welcome");
}
})();
