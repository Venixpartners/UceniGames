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
  await page.locator('button[data-go="account"]').click();
  await page.locator('button[data-act="hide"]').click();
  await page.locator('button[data-go="home"]').click();
  await page.locator('button[data-start="maths"]').click();
  await page.locator('button[data-act="begin"]').click();
  for(let i=0;i<10;i++){
    await page.locator('button[data-ans="0"]').waitFor({timeout:30000});
    await page.locator('button[data-ans="0"]').click();
    await page.locator('button[data-act="next"]').waitFor({timeout:30000});
    await page.locator('button[data-act="next"]').click();
  }
  await page.getByText('Knowledge Points',{exact:true}).waitFor({timeout:30000});
  await page.locator('button[data-go="progress"]').click();
  await page.getByText('Your progress').waitFor({timeout:15000});
  await page.locator('button[data-go="account"]').click();
  await page.getByText('Free preview: no subscription').waitFor({timeout:15000});
  await page.locator('button[data-act="sign_out"]').click();
  await page.locator('#dname').waitFor({timeout:15000});
  assert.deepEqual(errors,[], 'No browser JavaScript errors expected');
  console.log('PASS: mobile browser sign-in, 10-question quiz, progress, account, sign-out');
}finally{await browser.close();}
