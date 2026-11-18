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
const afterA=success(await request('me',a.token),'A profile').profile;
const afterB=success(await request('me',b.token),'B profile').profile;
assert.equal(afterA.sessions,1);
assert.equal(afterB.sessions,0,'the same entered number must not identify another guest account');
assert.equal(afterA.billing_live,false);
assert.equal(afterA.subscription,null);
success(await request('sign_out',a.token),'sign out A');
assert.equal((await request('me',a.token)).status,401,'signed-out token must be revoked');
const adminUrl=config.match(/adminUrl:\s*"([^"]+)"/)?.[1];
assert.ok(adminUrl);
assert.equal((await request('stats',null,{},adminUrl)).status,401,'admin stats must reject unauthenticated calls');
console.log('PASS: production free-preview guest isolation, 10-question gameplay, review, API authorisation and no paid access');
