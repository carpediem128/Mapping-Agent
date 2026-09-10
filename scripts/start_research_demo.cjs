const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
const b=await chromium.launch({channel:'msedge',headless:true});
const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('http://127.0.0.1:4173/#hotspots');
await p.getByLabel('研究主题',{exact:true}).fill('玻璃基板 TGV');
const response=p.waitForResponse(r=>r.url().endsWith('/api/research')&&r.request().method()==='POST');
await p.getByRole('button',{name:'开始研究',exact:true}).click();
const job=await (await response).json();
if(!job.id)throw Error(JSON.stringify(job));
fs.writeFileSync('runs/research_demo_job.json',JSON.stringify(job,null,2));
console.log(JSON.stringify(job));
await p.screenshot({path:'runs/research_started.png'});
await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
