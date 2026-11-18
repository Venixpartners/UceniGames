// Controlled end-to-end smoke test. Creates two synthetic free-preview guest accounts.
// No real SMS is sent, no subscription is activated, and both test profiles are hidden from leaderboards.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const config = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const apiUrl = config.match(/apiUrl:\s*"([^"]+)"/)?.[1];
const key = config.match(/publishableKey:\s*"([^"]+)"/)?.[1];
assert.ok(apiUrl && key, 'API endpoint and publishable key required');
const phone = '08000000000'; // synthetic placeholder, never persisted as a subscriber identity
async function request(action, token, data = {}, endpoint = apiUrl) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type':'application/json', apikey:key, ...(token?{'x-uceni-token':token}:{})},
    body: JSON.stringify({action,...data}),
    signal: AbortSignal.timeout(20000),
  });
  const payload = await res.json().catch(()=>({}));
  return {status:res.status, body:payload};
}
function success(r, label){assert.equal(r.status,200, label+': '+JSON.stringify(r.body).slice(0,220));return r.body;}
const a=success(await request('sign_in',null,{phone,display_name:'QA Hidden One'}),'sign in A');
const b=success(await request('sign_in',null,{phone,display_name:'QA Hidden Two'}),'sign in B');
assert.notEqual(a.token,b.token);
assert.equal(a.profile.sessions,0);
assert.equal(b.profile.sessions,0);
assert.match(a.profile.phone,/Unverified free-play session/);
success(await request('settings',a.token,{hide_board:true}),'hide A');
success(await request('settings',b.token,{hide_board:true}),'hide B');
const blocked=await request('subscribe',a.token,{plan_id:'daily'});
assert.equal(blocked.status,503,'billing must be unavailable');
assert.equal((await request('request_otp',null,{phone})).status,503,'OTP must not be exposed');
const s=success(await request('start',a.token,{subject_id:'maths',level:'beginner'}),'start 10-question round');
assert.equal(s.total,10);
for(let i=0;i<10;i++){
  const q=success(await request('question',a.token,{session_id:s.session_id}),'get question '+i);
  assert.equal(q.index,i);
  assert.equal(q.options.length,4);
  const ans=success(await request('answer',a.token,{session_id:s.session_id,index:i,choice:0}),'answer '+i);
  assert.equal(typeof ans.correct,'boolean');
  assert.ok(typeof ans.explanation==='string' && ans.explanation.trim().length>=5);
  if(i===0)assert.equal((await request('answer',a.token,{session_id:s.session_id,index:i,choice:0})).status,409,'resubmitted answer must be rejected');
}
const done=success(await request('finish',a.token,{session_id:s.session_id}),'finish round');
assert.equal(done.total,10);
const review=success(await request('review',a.token,{session_id:s.session_id}),'review round');
assert.equal(review.answers.length,10);
// Validate every subject and level can select a question; abandoned rounds do not award points.
for(const subject_id of ['maths','english','science','history','geography','health','tech','gk']){
  for(const level of ['beginner','intermediate','advanced']){
    const started=success(await request('start',a.token,{subject_id,level}),subject_id+'/'+level+' start');
    assert.equal(started.total,10);
    const question=success(await request('question',a.token,{session_id:started.session_id}),subject_id+'/'+level+' question');
    assert.equal(question.options.length,4);
    assert.ok(question.prompt && question.prompt.length>5);
  }
}
const adminUrl=config.match(/adminUrl:\s*"([^"]+)"/)?.[1];
assert.ok(adminUrl);
const missingAuth=await request('stats',null,{},adminUrl);
assert.equal(missingAuth.status,401,'admin stats require a session');
const invalidLogin=await request('login',null,{email:'qa-nonexistent-uceni-test@example.invalid',password:'deliberately-wrong'},adminUrl);
assert.equal(invalidLogin.status,401,'admin must reject invalid credentials');

// Gamified Learning Experience: achievements, daily quests, avatar and friend challenge.
const gameBefore=success(await request('me',a.token),'gamified profile').profile;
assert.equal(gameBefore.game.badges.length,20,'Exactly twenty achievement badges');
assert.equal(gameBefore.game.daily.length,3,'Three daily quests');
assert.ok(gameBefore.game.weekly_points>=0);
const savedAvatar=success(await request('settings',a.token,{avatar:'rocket'}),'set avatar');
assert.equal(savedAvatar.profile.avatar,'rocket');
assert.equal((await request('settings',a.token,{avatar:'not-allowed'})).status,400,'reject unknown avatar');
const weekly=success(await request('weekly_board',a.token),'weekly learning board');
assert.ok(Array.isArray(weekly.top),'weekly board array');
const challenge=success(await request('challenge_create',a.token,{session_id:s.session_id}),'share completed round');
assert.match(challenge.code,/^[a-f0-9]{24}$/);
const lookup=success(await request('challenge_lookup',b.token,{code:challenge.code}),'lookup friend challenge').challenge;
assert.equal(lookup.subject_id,'maths');
const friend=success(await request('start',b.token,{subject_id:'maths',level:'beginner',challenge_code:challenge.code}),'friend starts same quiz');
assert.equal(friend.friend.score,done.correct);
const opponentQuestion=success(await request('question',b.token,{session_id:friend.session_id}),'friend question');
const originalReview=success(await request('review',a.token,{session_id:s.session_id}),'original review');
assert.equal(opponentQuestion.question_id,originalReview.answers[0].question_id,'same first question for both players');
assert.equal((await request('challenge_lookup',b.token,{code:'invalid'})).status,400,'reject invalid challenge');

// Personalised revision must prioritise approved questions missed in the prior completed round.
const missedIds=new Set(originalReview.answers.filter(x=>!x.is_correct).map(x=>x.question_id));
const practice=success(await request('start',a.token,{subject_id:'maths',level:'beginner',practice_mode:true}),'start adaptive practice');
assert.equal(practice.total,10,'Adaptive practice preserves exactly ten questions');
const revisited=success(await request('question',a.token,{session_id:practice.session_id}),'adaptive first question');
if(missedIds.size>0)assert.ok(missedIds.has(revisited.question_id),'Previously missed questions should be prioritised');
const afterA=success(await request('me',a.token),'A profile').profile;
const afterB=success(await request('me',b.token),'B profile').profile;
assert.equal(afterA.sessions,1);
assert.equal(afterB.sessions,0,'the same entered number must not identify another guest account');
assert.equal(afterA.billing_live,false);
assert.equal(afterA.subscription,null);
success(await request('sign_out',a.token),'sign out A');
assert.equal((await request('me',a.token)).status,401,'signed-out token must be revoked');
console.log('PASS: production free-preview guest isolation, 10-question gameplay, review, API authorisation and no paid access');
