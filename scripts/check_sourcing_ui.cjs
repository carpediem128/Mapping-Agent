const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge'});
 try {
  const page = await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Isolated fixture verifies manual assessment without writing to research data.
  await page.route('**/api/research',route=>route.fulfill({json:{jobs:[{
   id:'ui-test',topic:'交互测试',status:'completed',progress:100,primary_count:1,review_count:0,
   secondary_count:0,source_count:1,download_url:'#',preview:[],
   sourcing:{coverage:[{name:'技术路线',executed:true,source_count:1}],companies:[{'公司名称':'测试企业','发现路径':['技术路线']}]}
  }]}}));
  await page.goto('http://127.0.0.1:4173/#overview');
  await page.locator('#research-desk').waitFor();
  await page.getByRole('button',{name:'任务记录',exact:true}).click();
  await page.getByText('投资筛选',{exact:true}).click();
  await page.getByLabel('测试企业投资吸引力').selectOption('高');
  await page.getByLabel('测试企业交易可行性').selectOption('高');
  assert.equal(await page.getByText('重点推进',{exact:true}).count(),1);
  await page.getByLabel('测试企业交易可行性').selectOption('低');
  assert.equal(await page.getByText('长期覆盖',{exact:true}).count(),1);
  assert.deepEqual(errors,[]);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('.side-nav').isVisible(),false);
  await page.getByRole('button',{name:'导航',exact:true}).click();
  assert.equal(await page.locator('.side-nav').isVisible(),true);
  await page.locator('.side-nav a[href="#imports"]').click();
  await page.waitForFunction(() => !document.querySelector('.sidebar').classList.contains('mobile-open'));
  assert.equal(await page.locator('.side-nav').isVisible(),false);
  console.log('PASS manual assessment, matrix recommendation, no JS errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
