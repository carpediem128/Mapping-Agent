const {chromium} = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/#hotspots');
  await page.locator('#research-desk').waitFor();
  await page.getByLabel('研究主题', {exact:true}).fill('玻璃基板 TGV');
  const routes=['overview','hotspots','industries','contacts','primary-mappings','secondary-mappings','imports'];
  const checks=[];
  for(const route of routes){
    await page.locator(`.side-nav a[href="#${route}"]`).click();
    checks.push({route,desk:await page.locator('#research-desk').isVisible(),topic:await page.locator('#research-topic').inputValue()});
  }
  await page.locator('.side-nav a[href="#hotspots"]').click();
  const card=page.locator('#hotspot-table-body tr').first();
  if(await card.count()){
    await card.dragTo(page.locator('#research-topic'));
    checks.push({dragTopic:await page.locator('#research-topic').inputValue()});
  }
  await page.getByRole('button',{name:'任务记录',exact:true}).click();
  await page.screenshot({path:'runs/research_desktop.png',fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'runs/research_mobile.png',fullPage:false});
  const overflow=await page.locator('#research-desk').evaluate(el=>el.scrollWidth>el.clientWidth);
  fs.writeFileSync('runs/research_ui_checks.json',JSON.stringify({checks,errors,deskOverflow:overflow},null,2));
  console.log(JSON.stringify({checks,errors,deskOverflow:overflow}));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
