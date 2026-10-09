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

/* ---------- Sound ---------- */
var soundOn = (function(){ try{ return localStorage.getItem("uceni_sound") !== "off"; }catch(e){ return true; } })();
var actx = null;
function tone(freq, start, len, type, vol){
  var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + start;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + len + 0.05);
}
function sfx(fn){
  if(!soundOn) return;
  try{ actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if(actx.state === "suspended") actx.resume(); fn(); }catch(e){}
}
function playTick(){ sfx(function(){ tone(1000,0,0.05,"sine",0.06); }); }
function playStar(n){ sfx(function(){ tone([523,659,784][n]||784,0,0.22,"triangle",0.2); }); }
function playFanfare(){ sfx(function(){ [523,659,784,1047].forEach(function(f,i){ tone(f,i*0.12,i===3?0.5:0.18,"triangle",0.22); }); }); }
function playSound(correct){
  if(!soundOn) return;
  try{
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if(actx.state === "suspended") actx.resume();
    if(correct){ tone(660,0,0.15,"sine",0.25); tone(880,0.12,0.25,"sine",0.25); }
    else { tone(200,0,0.18,"square",0.08); tone(150,0.16,0.3,"square",0.08); }
  }catch(e){}
}

/* ---------- Icons ---------- */
var ICON = {
  maths:'<path d="M4 8h6M7 5v6M14 8h6M14 16h6M14 19h6M4.5 15.5l5 5M9.5 15.5l-5 5"/>',
  english:'<path d="M3 19l5-14 5 14M5 14h6M15 11h6M15 15h6M15 19h6"/>',
  science:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10"/>',
  history:'<path d="M3 9l9-5 9 5M5 9v9M10 9v9M14 9v9M19 9v9M3 20h18"/>',
  geography:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  health:'<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  tech:'<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  gk:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>'
};
function icon(id){ return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(ICON[id]||ICON.gk)+'</svg>'; }
var FLAME = '<svg class="fl" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 22c-4.2 0-7-2.8-7-6.6 0-3.6 3-5.6 4-9.4 2 1.5 3.1 3.2 3.1 5.3 1-1 1.5-2.1 1.5-3.6 2.6 2.1 4.4 4.7 4.4 7.7 0 3.8-2.6 6.6-6 6.6z"/></svg>';
function star(on){ return '<svg class="st'+(on?' on':'')+'" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2.5 15 9 22 9.6 16.7 14.2 18.3 21 12 17.4 5.7 21 7.3 14.2 2 9.6 9 9"/></svg>'; }
var BOLT = '<svg class="bolt" viewBox="0 0 24 24" aria-hidden="true"><polygon fill="currentColor" points="13 2 4 14 11 14 10 22 20 9 13 9"/></svg>';
var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Learners online ---------- */
var onlineN = 0, onlineTimer = null;
function onlineHtml(){ return '<span class="online" aria-live="polite"'+(onlineN>0?'':' hidden')+'><i></i><b class="online-n">'+onlineN.toLocaleString()+'</b> learner'+(onlineN===1?'':'s')+' online now</span>'; }
function refreshOnline(){
  api("online").then(function(d){
    onlineN = d.online || 0;
    Array.prototype.forEach.call(document.querySelectorAll(".online"),function(el){ el.outerHTML = onlineHtml(); });
  }).catch(function(){});
}
function startOnline(){ refreshOnline(); if(!onlineTimer) onlineTimer = setInterval(function(){ if(!document.hidden) refreshOnline(); }, 30000); }

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
  Array.prototype.forEach.call(document.querySelectorAll(".confetti"),function(c){ c.parentNode.removeChild(c); });
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
  var tb = document.getElementById("toponline"); if(tb) tb.innerHTML = onlineHtml();
  if(AFTER[screen]) AFTER[screen](arg);
}
function loading(msg){ app.innerHTML = '<div class="loading">'+esc(msg||"Loading")+'</div>'; }
function showError(err, retryScreen){
  if(err && err.status === 401){ setToken(null); P=null; go("welcome"); return; }
  app.innerHTML = '<div class="stack" style="margin-top:2rem"><h1>Something went wrong</h1><p>'+esc(err.message)+'</p>'+
    '<button class="btn" data-go="'+(retryScreen||"home")+'">Try again</button></div>';
  tabs.hidden = true;
}
function hasAccess(){ return !!P && (!P.billing_live || !!P.subscription); }

var SCREENS = {}, AFTER = {};

/* ---------- Welcome and sign in ---------- */
SCREENS.welcome = function(){
  return '<div class="stack">'+
    '<img class="hero-logo logo-dark" src="/assets/uceni-wordmark.svg" alt="uceni">'+
    '<img class="hero-logo logo-light" src="/assets/uceni-wordmark-white.svg" alt="uceni">'+
    '<p class="tag">Learn. Think. Grow.</p>'+
    onlineHtml()+
    '<div class="pitch"><span>'+icon("maths")+'</span><span>'+icon("science")+'</span><span>'+icon("geography")+'</span><span>'+icon("english")+'</span><span>'+icon("gk")+'</span></div>'+
    '<p>Eight subjects, three levels, ten quick questions a round. Enter your name and phone number to play.</p>'+
    '<label class="field"><span>Your name</span><input id="dname" type="text" maxlength="24" autocomplete="given-name" value="'+esc(pendingName)+'" data-autofocus></label>'+
    '<label class="field"><span>Phone number</span><input id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 123 4567" value="'+esc(pendingPhone)+'"></label>'+
    '<p class="err" id="err" aria-live="polite"></p>'+
    '<button class="btn big-btn" data-act="sign_in">Let\'s play</button>'+
    '<p class="small">By continuing you agree to the <a href="/legal/terms.html">Terms of Service</a> and <a href="/legal/privacy.html">Privacy Notice</a>.</p>'+
    '<p class="note">Knowledge Points show your learning progress only. They have no cash value and cannot be exchanged for money, airtime, data or gifts.</p>'+
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
  var nm = P.display_name || "Learner";
  return '<div class="player">'+
      '<div class="who"><span class="av">'+esc(nm.charAt(0).toUpperCase())+'</span><span><span class="small">'+greet()+'</span><b>'+esc(nm)+'</b></span></div>'+
      '<div class="chips">'+
        '<div><b>'+P.total_points.toLocaleString()+'</b><span>points</span></div>'+
        '<div class="streak'+(P.streak?' lit':'')+'"><b>'+FLAME+P.streak+'</b><span>day streak</span></div>'+
        '<div><b>'+P.sessions+'</b><span>rounds</span></div>'+
      '</div>'+
      '<p class="goal">'+(P.streak?'Play a round today to keep your streak alive.':'Play a round today to light your streak.')+'</p>'+
    '</div>'+
    (!hasAccess()?'<div class="notice" style="margin-top:1.25rem">Your plan has ended. <button class="btn quiet" data-go="plans">Choose a plan</button> to keep learning.</div>':'')+
    '<h2 style="margin-top:1.75rem">Pick a subject</h2>'+
    '<ul class="tiles">'+P.subjects.map(function(s){
      var l = s.level, pct = l.next ? Math.round((s.points-l.floor)/(l.next-l.floor)*100) : 100;
      return '<li><button class="tile" data-start="'+esc(s.id)+'">'+
        '<span class="ico">'+icon(s.id)+'</span>'+
        '<span class="nm">'+esc(s.name)+'</span>'+
        '<span class="rk">'+esc(l.name)+(l.next?'<span>, '+(l.next-s.points)+' to '+esc(l.next_name)+'</span>':'')+'</span>'+
        '<span class="bar"><i style="width:'+pct+'%"></i></span>'+
      '</button></li>';}).join("")+'</ul>';
};

/* ---------- Difficulty ---------- */
SCREENS.difficulty = function(){
  var subj = P.subjects.filter(function(s){ return s.id===pendingSubject; })[0];
  return '<div class="stack">'+
    '<button class="btn quiet" data-go="home">Back to subjects</button>'+
    '<div class="subhead"><span class="ico">'+icon(pendingSubject)+'</span><h1>'+esc(subj?subj.name:"Choose a level")+'</h1></div>'+
    '<p>Pick your challenge. Less time, more points.</p>'+
    '<ul class="modes" role="radiogroup" aria-label="Difficulty level">'+P.difficulty.map(function(d,i){
      return '<li><button class="mode" role="radio" aria-checked="'+(d.id===chosenLevel)+'" data-level="'+esc(d.id)+'">'+
        '<span class="stars">'+star(true)+star(i>0)+star(i>1)+'</span>'+
        '<b>'+esc(d.name)+'</b>'+
        '<span class="secs">'+d.seconds+'<small>s</small></span>'+
        '<span class="small">per question</span>'+
        '<span class="pts">+'+d.points_per_correct+' each</span>'+
      '</button></li>';}).join("")+'</ul>'+
    '<p class="small">'+BOLT+' Answer in the first half of the time for 5 bonus points.</p>'+
    '<button class="btn big-btn" data-act="begin" data-autofocus>Start round</button>'+
  '</div>';
};

/* ---------- Session ---------- */
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }

function startSession(subjectId, level){
  if(!hasAccess()){ goTo("plans"); return; }
  level = level || chosenLevel;
  loading("Preparing your questions");
  api("start",{subject_id:subjectId, level:level}).then(function(d){
    sess = {id:d.session_id, subjectId:subjectId, levelId:level, levelName:d.level, subject:d.subject, total:d.total, seconds:d.question_seconds,
            ppc:d.points_per_correct||10, score:0, combo:0, best:0, marks:[], locked:false, q:null};
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

function dots(marks,total,cur){
  var h=''; for(var i=0;i<total;i++){ h+='<i class="'+(marks[i]===true?'g':marks[i]===false?'r':i===cur?'c':'')+'"></i>'; } return '<span class="dots" aria-hidden="true">'+h+'</span>';
}
SCREENS.session = function(){
  var q = sess.q;
  return '<div class="hud">'+
      '<button class="x" data-act="quit" aria-label="End round">&times;</button>'+
      '<span class="small">'+esc(sess.subject)+', '+esc(sess.levelName)+'</span>'+
      '<span class="score" id="score" aria-label="Round score">'+sess.score+'<small> pts</small></span>'+
    '</div>'+
    '<div class="hud2">'+dots(sess.marks,q.total,q.index)+'<span class="combo'+(sess.combo>=2?' on':'')+'" id="combo">'+(sess.combo>=2?sess.combo+' in a row':'')+'</span></div>'+
    '<div class="clock"><span class="secs" id="secs">'+q.seconds_left+'</span>'+
      '<div class="timer" id="tbar" role="progressbar" aria-label="Time left" aria-valuemin="0" aria-valuemax="'+sess.seconds+'" aria-valuenow="'+q.seconds_left+'"><i id="tfill"></i></div></div>'+
    '<p class="small qn">Question '+(q.index+1)+' of '+q.total+'</p>'+
    '<p class="q">'+esc(q.prompt)+'</p>'+
    '<ul class="opts">'+q.options.map(function(o,i){return '<li><button class="opt" data-ans="'+i+'" aria-label="'+"ABCD"[i]+': '+esc(o)+'"><span class="bub" aria-hidden="true">'+"ABCD"[i]+'</span><span>'+esc(o)+'</span></button></li>';}).join("")+'</ul>'+
    '<div id="fb" aria-live="polite"></div>';
};
AFTER.session = function(){
  var q = sess.q, fill = document.getElementById("tfill"), bar = document.getElementById("tbar"), secs = document.getElementById("secs");
  var endAt = Date.now() + q.seconds_left*1000, lastWhole = q.seconds_left;
  function tick(){
    var left = Math.max(0,(endAt-Date.now())/1000), whole = Math.ceil(left);
    fill.style.width = (left/sess.seconds*100)+"%";
    bar.setAttribute("aria-valuenow",whole);
    if(whole !== lastWhole){ lastWhole = whole; secs.textContent = whole; if(whole<=5 && whole>0) playTick(); }
    if(left<=5){ bar.classList.add("low"); secs.classList.add("low"); }
    if(left<=0) answer(null);
  }
  tick(); timerId = setInterval(tick,100);
  var first = app.querySelector("[data-ans]"); if(first) first.focus({preventScroll:true});
};

function floatPts(el, text){
  if(reduceMotion || !el) return;
  var f = document.createElement("span"); f.className = "float"; f.textContent = text; el.appendChild(f);
  setTimeout(function(){ if(f.parentNode) f.parentNode.removeChild(f); }, 1100);
}

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
    playSound(r.correct);
    sess.marks[sess.q.index] = !!r.correct;
    var gained = 0;
    if(r.correct){ gained = sess.ppc + (r.fast?5:0); sess.score += gained; sess.combo++; sess.best = Math.max(sess.best, sess.combo);
      floatPts(btns[r.answer], "+"+gained+(r.fast?" quick":"")); btns[r.answer].classList.add("pop"); }
    else { sess.combo = 0; if(k!==null && btns[k]) btns[k].classList.add("shake"); }
    var sc = document.getElementById("score"); if(sc){ sc.innerHTML = sess.score+'<small> pts</small>'; if(gained) { sc.classList.remove("bump"); void sc.offsetWidth; sc.classList.add("bump"); } }
    var cb = document.getElementById("combo"); if(cb){ cb.textContent = sess.combo>=2 ? sess.combo+" in a row" : ""; cb.className = "combo"+(sess.combo>=2?" on":""); }
    var dt = app.querySelector(".dots"); if(dt) dt.outerHTML = dots(sess.marks, sess.q.total, -1);
    var L = "ABCD"[r.answer];
    var cheers = ["Correct!","Nice one!","Spot on!","Brilliant!","Well done!"];
    var head = r.correct ? (sess.combo>=3 ? sess.combo+" in a row!" : cheers[Math.floor(Math.random()*cheers.length)]) : (k===null || r.timed_out ? "Time is up. The answer is "+L+"." : "Not quite. The answer is "+L+".");
    sess.last = r.is_last;
    document.getElementById("fb").innerHTML = '<div class="fb '+(r.correct?"good":"bad")+'"><strong>'+head+'</strong>'+esc(r.explanation)+'</div>'+
      '<div style="margin-top:1rem"><button class="btn big-btn" data-act="next">'+(r.is_last?"See my stars":"Next question")+'</button></div>'+
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
    r.subject = sess.subject; r.subject_id = sess.subjectId; r.level_id = sess.levelId; r.session_id = sess.id; r.marks = sess.marks; r.best = sess.best;
    sess = null;
    return refreshProfile().then(function(){ go("results",r); });
  }).catch(function(e){ showError(e,"home"); });
}

function starsFor(c){ return c>=9?3:c>=7?2:c>=5?1:0; }
SCREENS.results = function(r){
  var b = r.breakdown, n = starsFor(r.correct);
  var title = ["Keep going","Good effort","Great work","Outstanding"][n];
  var line = n===3?"You clearly know this area well.":n===2?"Review the explanations to go for three stars.":n===1?"Every round adds to what you know.":"Read the explanations, then try again.";
  return '<div class="stack results">'+
    '<p class="small">'+esc(r.subject)+', '+esc(r.level)+' level</p>'+
    '<div class="bigstars" id="bigstars">'+star(false)+star(false)+star(false)+'</div>'+
    '<h1>'+title+'</h1>'+
    '<p class="big">'+r.correct+'<small> of '+r.total+'</small></p>'+
    (r.marks?dots(r.marks,r.total,-1):'')+
    '<p>'+line+(r.best>=3?' Best run: '+r.best+' in a row.':'')+'</p>'+
    '<div class="earned"><span>+<b id="earned">0</b></span><small>Knowledge Points</small></div>'+
    (r.level_up?'<div class="rankup"><b>New rank</b>You are now '+esc(r.level_up)+' in '+esc(r.subject)+'.</div>':'')+
    '<dl class="kv">'+
      '<div><dt>Correct answers ('+r.points_per_correct+' each)</dt><dd>'+b.correct+'</dd></div>'+
      '<div><dt>Quick answer bonus</dt><dd>'+b.quick+'</dd></div>'+
      '<div><dt>Round completed</dt><dd>'+b.completed+'</dd></div>'+
      (b.streak?'<div><dt>Daily streak</dt><dd>'+b.streak+'</dd></div>':'')+
    '</dl>'+
    '<div class="row" style="margin-top:1.5rem"><button class="btn" data-again="'+esc(r.subject_id)+'" data-lv="'+esc(r.level_id)+'" data-autofocus>Play again</button><button class="btn alt" data-go="home">Subjects</button></div>'+
    '<button class="btn quiet" data-review="'+esc(r.session_id)+'">Review my answers</button>'+
  '</div>';
};
AFTER.results = function(r){
  var n = starsFor(r.correct), holder = document.getElementById("bigstars"), el = document.getElementById("earned");
  var stars = holder ? holder.querySelectorAll(".st") : [];
  for(var i=0;i<n;i++){ (function(i){ setTimeout(function(){ if(stars[i]) stars[i].classList.add("on","pop"); playStar(i); }, reduceMotion?0:400+i*350); })(i); }
  if(reduceMotion){ el.textContent = r.points; }
  else { var t0 = null, dur = 900; (function step(ts){ if(!t0) t0 = ts; var p = Math.min(1,(ts-t0)/dur); el.textContent = Math.round(r.points*p); if(p<1) requestAnimationFrame(step); })(performance.now()); }
  if(r.level_up){ setTimeout(function(){ playFanfare(); confetti(); }, 400+n*350); }
};
function confetti(){
  if(reduceMotion) return;
  var box = document.createElement("div"); box.className = "confetti"; box.setAttribute("aria-hidden","true");
  var cols = ["#1a7a3a","#c21c2d","#cdd8e5","#e2a1a1","#000000"];
  for(var i=0;i<60;i++){ var c = document.createElement("i"); c.style.left = Math.random()*100+"%"; c.style.background = cols[i%cols.length];
    c.style.animationDelay = (Math.random()*0.6)+"s"; c.style.animationDuration = (1.6+Math.random()*1.4)+"s"; c.style.transform = "rotate("+Math.random()*360+"deg)"; box.appendChild(c); }
  document.body.appendChild(box); setTimeout(function(){ if(box.parentNode) box.parentNode.removeChild(box); }, 3500);
}

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

function podium(top){
  var order = [top[1], top[0], top[2]], h = ["p2","p1","p3"];
  return '<div class="podium">'+order.map(function(x,i){ if(!x) return '<div class="pd empty"></div>';
    return '<div class="pd '+h[i]+(x.me?' me':'')+'"><span class="av">'+esc(x.name.charAt(0).toUpperCase())+'</span><b>'+esc(x.name)+(x.me?' (you)':'')+'</b><span class="small">'+x.points.toLocaleString()+' pts</span><span class="step">'+x.rank+'</span></div>'; }).join("")+'</div>';
}
SCREENS.board = function(d){
  if(!d) return '<div class="loading">Loading</div>';
  var inTop = d.top.some(function(x){return x.me;});
  return '<h1>Learning board</h1>'+
    '<p>See how your progress compares with other learners. The board is for motivation only and carries no reward of any kind.</p>'+
    (d.top.length?podium(d.top.slice(0,3))+(d.top.length>3?'<ol class="board" start="4">'+d.top.slice(3).map(function(x){return '<li'+(x.me?' class="me"':'')+'><span class="rk">'+x.rank+'</span><span>'+esc(x.name)+(x.me?" (you)":"")+'</span><span class="pt">'+x.points.toLocaleString()+'</span></li>';}).join("")+'</ol>':'')
      :'<p class="notice">No one is on the board yet. Finish a round to be the first.</p>')+
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
    '<div class="toggle" style="margin-top:.75rem"><span>Sound effects</span><button class="sw" role="switch" aria-checked="'+soundOn+'" aria-label="Sound effects" data-act="sound"></button></div>'+
    '<div class="toggle" style="margin-top:.75rem"><span>Hide me from the learning board</span><button class="sw" role="switch" aria-checked="'+P.hide_board+'" aria-label="Hide me from the learning board" data-act="hide"></button></div>'+
    '<div class="stack" style="margin-top:1.5rem">'+
      '<button class="btn alt" data-go="plans">'+(s?"Change plan":"Choose a plan")+'</button>'+
      (s&&s.status==="active"?'<button class="btn alt" data-act="cancel">Unsubscribe</button>':'')+
    '</div>'+
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
function signIn(t){
  pendingName=document.getElementById("dname").value; pendingPhone=document.getElementById("phone").value;
  busy(t,true); setErr("");
  api("sign_in",{display_name:pendingName, phone:pendingPhone}).then(function(d){ setToken(d.token); P=d.profile; go("home"); refreshOnline(); })
    .catch(function(err){ busy(t,false); setErr(err.message); });
}
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
  var a = t.dataset.act;
  if(a==="sign_in"){ signIn(t); return; }
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
  if(a==="quit"){ if(confirm("End this round? Points from this round will not be saved.")){ sess=null; stopTimer(); go("home"); } return; }
  if(a==="flag"){
    var reason = prompt("What is wrong with this question? For example, the answer is wrong or the wording is unclear.");
    if(reason===null) return;
    api("flag",{question_id:t.dataset.q, reason:reason}).then(function(){ t.outerHTML='<span class="small">Thank you. We will review this question.</span>'; }).catch(function(){});
    return;
  }
  if(a==="sound"){ soundOn=!soundOn; t.setAttribute("aria-checked",soundOn); try{ localStorage.setItem("uceni_sound", soundOn?"on":"off"); }catch(err){} if(soundOn) playSound(true); return; }
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
  if(a==="sign_out"){ api("sign_out").catch(function(){}).then(function(){ setToken(null); P=null; go("welcome"); }); return; }
});

document.addEventListener("keydown",function(e){
  if(current==="welcome" && e.key==="Enter" && e.target.tagName==="INPUT"){ e.preventDefault(); var b=app.querySelector('[data-act="sign_in"]'); if(b && !b.disabled) signIn(b); return; }
  if(current!=="session"||!sess||sess.locked) return;
  if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
  var m = {"1":0,"2":1,"3":2,"4":3,"a":0,"b":1,"c":2,"d":3}[e.key.toLowerCase()];
  if(m!==undefined){ e.preventDefault(); answer(m); }
});

/* ---------- Start ---------- */
startOnline();
if(getToken()){
  refreshProfile().then(function(){ go("home"); })
    .catch(function(e){ if(e.status===401){ setToken(null); go("welcome"); } else showError(e,"home"); });
} else {
  go("welcome");
}
})();
