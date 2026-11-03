const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1672,height:941}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/?design=reference#overview');
  await page.locator('.reference-contact-summary progress').waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.reference-metric-icon svg').length===5);
  await page.locator('.reference-theme-list button').first().waitFor();
  await page.locator('#primary-mappings .mapping-sector-card').first().waitFor({state:'attached'});
  assert.equal(await page.locator('#topbar .metrics').count(),1);
  assert.equal(await page.locator('.metric-mini-viz').count(),5);
  assert.equal(await page.locator('#metric-hotspots').getAttribute('data-unit'),'个');
  const original=await page.locator('#metric-hotspots').textContent();
  await page.locator('#metric-hotspots').evaluate(el=>el.textContent='25');
  await page.waitForFunction(()=>document.querySelector('.metric-mini-viz').getAttribute('aria-label').includes('25个'));
  assert.equal(await page.locator('.metric-mini-viz').first().locator('rect').count(),6);
  await page.locator('#metric-hotspots').evaluate((el,value)=>el.textContent=value,original);
  const routes=['overview','hotspots','industries','contacts','primary-mappings','secondary-mappings','imports'];
  for(const route of routes){
   await page.locator(`.side-nav a[href="#${route}"]`).click();
   await page.locator(`.view-panel.active[data-view="${route}"]`).waitFor({state:'visible'});
   await page.waitForTimeout(450);
   assert.equal(await page.locator('#topbar').evaluate(e=>e.classList.contains('compact-header')),route!=='overview');
   await page.screenshot({path:`runs/reference-${route}.png`});
  }
  await page.locator('.reference-metric-icon').first().click();
  assert.equal(await page.locator('.side-nav a.active').getAttribute('href'),'#hotspots');
  const nav=page.locator('.side-nav a[href="#overview"]');await nav.click();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.side-nav a[href="#overview"]')).backgroundColor==='rgb(221, 223, 208)');
  const progress=page.locator('.reference-contact-summary progress');
  const metric=parseFloat(await page.locator('#metric-contact-rate').textContent());
  assert.equal(await progress.evaluate(e=>e.value),metric);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('.side-nav').isVisible(),false);
  await page.getByRole('button',{name:'导航',exact:true}).click();
  await page.locator('.side-nav a[href="#imports"]').click();
  await page.waitForFunction(()=>!document.querySelector('.sidebar').classList.contains('mobile-open'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'runs/reference-mobile.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.view-panel.active').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.deepEqual(errors,[]);console.log('PASS 7 pages, 5 icons, metric navigation, sidebar selection, live coverage, mobile menu, reduced motion');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
