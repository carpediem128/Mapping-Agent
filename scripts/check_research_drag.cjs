const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch({channel:'msedge',headless:true});
const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('http://127.0.0.1:4173/#hotspots');
const source=p.locator('#hotspot-bars [data-sector]').first();
await source.waitFor();
const expected=await source.getAttribute('data-sector');
await p.locator('#research-topic').fill('');
await source.dragTo(p.locator('#research-desk'));
const actual=await p.locator('#research-topic').inputValue();
console.log(JSON.stringify({expected,actual,draggable:await source.getAttribute('draggable')}));
if(actual!==expected)throw Error('Drag did not transfer topic');
await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
