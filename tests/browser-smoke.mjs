import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('https://games.uceni.africa/',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#dname').waitFor({timeout:20000});
  assert.match(await page.locator('#banner').innerText(),/Free preview/);
  await page.locator('#dname').fill('QA Mobile Browser');
  await page.locator('#phone').fill('08000000000');
  await page.locator('button[data-act="sign_in"]').click();
  await page.getByText('Pick a subject').waitFor({timeout:30000});
  await page.getByText('Daily Brain Quests').waitFor({timeout:10000});
  await page.locator('button[data-go="achievements"]').click();
  await page.getByText('Achievement Gallery').waitFor({timeout:10000});
  assert.equal(await page.locator('.badge-tile').count(),20);
  await page.getByRole('button',{name:'Back to subjects'}).click();
  await page.locator('button[data-go="weekly"]').click();
  await page.getByText('Weekly Learning Board').waitFor({timeout:10000});
  await page.getByRole('button',{name:'Back to subjects'}).click();
  await page.locator('button[data-go="account"]').click();
  await page.locator('button[data-act="hide"]').click();
  await page.locator('button[data-avatar="rocket"]').click();
  await page.locator('button[data-avatar="rocket"][aria-pressed="true"]').waitFor({timeout:10000});
  await page.locator('#tabs button[data-go="home"]').click();
  await page.locator('button[data-start="maths"]').click();
  await page.locator('button[data-act="begin"]').click();
  for(let i=0;i<10;i++){
    await page.locator('button[data-ans="0"]').waitFor({timeout:30000});
    await page.locator('button[data-ans="0"]').click();
    await page.locator('button[data-act="next"]').waitFor({timeout:30000});
    await page.locator('button[data-act="next"]').click();
  }
  await page.getByText('Knowledge Points',{exact:true}).waitFor({timeout:30000});
  await page.getByRole('button',{name:'Subjects'}).click();
  await page.locator('button[data-go="progress"]').click();
  await page.getByText('Your progress').waitFor({timeout:15000});
  await page.getByText('Your Learning Adventure').waitFor({timeout:10000});
  await page.getByText('Personal best',{exact:false}).waitFor({timeout:10000});
  await page.locator('button[data-practice]').waitFor({timeout:10000});
  // A full completed quiz awards the learner's own badge; verify earned-only sharing.
  await page.locator('#tabs button[data-go="home"]').click();
  await page.locator('button[data-go="achievements"]').click();
  await page.locator('button[data-badge-choice]').first().waitFor({timeout:15000});
  const earnedCount=await page.locator('button[data-badge-choice]').count();
  assert.ok(earnedCount>=1&&earnedCount<=20,'Only earned badges should expose sharing buttons');
  await page.locator('button[data-badge-choice]').first().click();
  await page.getByText('Share your badge',{exact:false}).waitFor({timeout:10000});
  const selected=await page.locator('#badgeShareSelect').inputValue();
  assert.ok(selected.length>1);
  const painted=await page.locator('#badgeShareCanvas').evaluate(el=>{
    const rgba=el.getContext('2d').getImageData(0,0,el.width,el.height).data;
    let opaque=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i]>0)opaque++;
    return opaque;
  });
  assert.ok(painted>100000,'Uceni badge preview should be rendered');
  await page.locator('#badgeFriendHandle').fill('@learningfriend');
  const downloadPromise=page.waitForEvent('download',{timeout:15000});
  await page.locator('button[data-badge-platform="download"]').click();
  const download=await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith('.png'));
  await page.locator('button[data-go="achievements"]').click();
  await page.locator('button[data-go="account"]').click();
  await page.getByText('Free preview: no subscription').waitFor({timeout:15000});
  await page.locator('button[data-act="sign_out"]').click();
  await page.locator('#dname').waitFor({timeout:15000});
  assert.deepEqual(errors,[], 'No browser JavaScript errors expected');
  console.log('PASS: mobile browser sign-in, 10-question quiz, progress, account, sign-out');
}finally{await browser.close();}
