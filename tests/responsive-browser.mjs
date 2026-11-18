import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.UCENI_TEST_URL||'https://games.uceni.africa/';
const browser=await chromium.launch({headless:true});
const failures=[];
try{
  for(const width of [320,375,390,768,1024,1440]){
    const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1,isMobile:width<768,hasTouch:width<768,reducedMotion:'reduce'});
    page.on('pageerror',e=>failures.push(width+': '+e.message));
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('#dname').waitFor({timeout:20000});
    assert.equal(await page.locator('meta[name=viewport]').getAttribute('content'),'width=device-width, initial-scale=1, viewport-fit=cover');
    const initial=await page.evaluate(()=>({page:document.documentElement.scrollWidth,screen:window.innerWidth}));
    assert.ok(initial.page<=initial.screen+2, 'Welcome overflows at '+width+': '+JSON.stringify(initial));
    await page.locator('#dname').fill('QA Responsive Mobile');
    await page.locator('#phone').fill('08000000000');
    await page.locator('button[data-act=sign_in]').click();
    await page.getByText('Daily Brain Quests').waitFor({timeout:20000});
    await page.locator('button[data-go=account]').click();
    await page.locator('button[data-act=hide]').click();
    for(const screen of ['home','progress','board','account']){
      await page.locator('#tabs button[data-go='+screen+']').click();
      const dim=await page.evaluate(()=>({page:document.documentElement.scrollWidth,screen:window.innerWidth}));
      assert.ok(dim.page<=dim.screen+2, screen+' horizontal overflow at '+width+': '+JSON.stringify(dim));
      const tabs=await page.locator('#tabs').boundingBox();
      assert.ok(tabs && tabs.x>=-2 && tabs.x+tabs.width<=width+2,'Tabs off-screen: '+width);
    }
    await page.locator('button[data-act=sign_out]').click();
    await page.locator('#dname').waitFor({timeout:10000});
    await page.close();
    console.log('PASS: responsive viewport '+width+'px');
  }
  assert.deepEqual(failures,[],'No JavaScript browser errors expected');
  console.log('PASS: six viewport sizes, all major screens, no horizontal overflow');
}finally{await browser.close();}
