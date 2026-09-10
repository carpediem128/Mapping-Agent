const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 const p=await b.newPage({viewport:{width:1440,height:1000}});
 await p.goto('http://127.0.0.1:4173/#primary-mappings');
 await p.getByRole('button',{name:'任务记录',exact:true}).click();
 const job=p.locator('.research-job').filter({hasText:'玻璃基板 TGV'}).filter({has:p.getByRole('link',{name:'下载 Mapping Excel'})}).first();
 await job.waitFor();
 const downloadPromise=p.waitForEvent('download');
 await job.getByRole('link',{name:'下载 Mapping Excel'}).click();
 const download=await downloadPromise;
 await download.saveAs('runs/research_browser_download.xlsx');
 const button=job.getByRole('button',{name:'加入 Mapping 看板',exact:true});
 if(await button.count()){
   const responsePromise=p.waitForResponse(r=>r.url().endsWith('/publish'));
   await button.click();
   const response=await responsePromise;
   if(!response.ok())throw Error(await response.text());
 }
 await p.goto('http://127.0.0.1:4173/#primary-mappings');
 await p.locator('#research-desk').waitFor();
 await p.screenshot({path:'runs/research_published.png'});
 console.log(JSON.stringify({download:download.suggestedFilename(),published:true}));
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
