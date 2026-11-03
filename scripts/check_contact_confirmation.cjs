const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let box,initial;
 try{
  await page.goto('http://127.0.0.1:4173/#overview');
  await page.locator('#primary-attention button').first().waitFor();
  assert.equal(await page.locator('#primary-attention button').count(),5);
  assert.ok(await page.locator('#market-attention button').count()>0);
  await page.waitForTimeout(1600);await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'runs/attention-overview.png'});
  await page.locator('.side-nav a[href="#contacts"]').click();
  box=page.locator('.contact-confirm').first();await box.waitFor();initial=await box.isChecked();
  const before=Number.parseInt(await page.locator('.funnel-stage-summary strong').nth(2).textContent());
  await box.setChecked(!initial);await page.getByText('已保存联系确认',{exact:true}).waitFor();
  assert.equal(Number.parseInt(await page.locator('.funnel-stage-summary strong').nth(2).textContent()),before+(initial?-1:1));
  await page.reload();box=page.locator('.contact-confirm').first();await box.waitFor();assert.equal(await box.isChecked(),!initial);
  await box.setChecked(initial);await page.getByText('已保存联系确认',{exact:true}).waitFor();
  assert.equal(Number.parseInt(await page.locator('.funnel-stage-summary strong').nth(2).textContent()),before);
  const bad=await page.request.post('http://127.0.0.1:4173/api/contact-confirmations',{data:{company:'not a known company',reached:true}});assert.equal(bad.status(),404);
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4173/#overview');await page.locator('#primary-attention button').first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'runs/attention-mobile.png'});
  assert.deepEqual(errors,[]);console.log('PASS overview heatmaps, contact toggle, live funnel, persisted reload, restore, unknown company rejection, mobile');
 }finally{
  if(box&&initial!==undefined&&await box.count()&&await box.isChecked()!==initial){await box.setChecked(initial);await page.waitForTimeout(500);}
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
