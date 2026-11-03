// Shared, deterministic data contracts for the funnel and topic network.
export const clean = value => String(value ?? '').trim();
export const companyKey = value => clean(value).replace(/\s+/g, '').toLowerCase();
export const themeName = value => clean(value).replace(/^\d{6}[\s_]+/, '').replace(/[\s_]*Mapping$/i, '').trim();
export function contactFlags(row) {
 const progress = clean(row.progress);
 const meeting = /^(是|已约见|已见面|已完成|已约)$/.test(clean(row.meeting));
 const meetingKnown = meeting || /^(否|未约见|未安排|未见面)$/.test(clean(row.meeting));
 const reached = meeting || /已联系(?:上)?|已加微信|有接触|可进一步沟通|已见面/.test(progress);
 const attempted = reached || /未联系上|待回复|已发邮件|已致电|被拒绝/.test(progress);
 return {hasContact: row.hasContact === true || ['landline','mobile','email','wechat'].some(k => !!clean(row[k])), attempted, reached, meeting, meetingKnown};
}
export function contactsModel(rows = []) {
 const companies = new Map();
 for (const row of rows) {
   const key = companyKey(row.company); if (!key) continue;
   if (!companies.has(key)) companies.set(key, {key, company:row.company, industries:new Set(), flags:{}, records:[]});
   const item=companies.get(key);item.records.push(row);
   const industries=[row.industry,...(Array.isArray(row.industries)?row.industries:[])].map(clean).filter(Boolean);
   for(const name of industries.length?industries:['待识别'])item.industries.add(name);
   for(const [flag,value] of Object.entries(contactFlags(row)))item.flags[flag]=!!item.flags[flag]||value;
 }
 return [...companies.values()];
}
export function funnelStats(companies, industry='') {
 const rows=companies.filter(c=>!industry||c.industries.has(industry));
 const count=key=>rows.filter(c=>c.flags[key]).length;
 return {total:rows.length,withContact:count('hasContact'),attempted:count('attempted'),reached:count('reached'),meetings:count('meeting'),meetingUnknown:rows.filter(c=>!c.flags.meetingKnown).length,
         stages:[['项目总量',rows.length],['已发起联系',count('attempted')],['已建立联系',count('reached')],['已确认约见',count('meeting')]]};
}
export function topicModel(mapping, contacts=[]) {
 const progress=new Map(contacts.map(c=>[c.key,c])); const topics=new Map();let recordCount=0;
 for(const row of mapping.records||[]) {
   if(row.sheet!=='一级市场'||!companyKey(row.company))continue;
   recordCount++;
   const name=themeName(row.source_label)||'未命名主题';
   if(!topics.has(name))topics.set(name,{id:name,name,companies:new Map()});
   const key=companyKey(row.company);const group=topics.get(name).companies;
   if(!group.has(key))group.set(key,{id:key,company:row.company,fields:row.fields||{},sources:[],contact:progress.get(key)||null});
   const item=group.get(key);item.sources.push({source:row.source_label,sheet:row.sheet,row:row.row_number});
 }
 return {recordCount,topics:[...topics.values()].map(t=>({...t,companies:[...t.companies.values()]})).sort((a,b)=>b.companies.length-a.companies.length||a.name.localeCompare(b.name))};
}
let pending;
let current;
export async function confirmContact(company,reached) {
 const response=await fetch('/api/contact-confirmations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company,reached})});
 if(!response.ok)throw Error('保存失败，请稍后重试');
 const result=await response.json();
 if(current){
   const item=current.contacts.find(c=>c.key===result.key);
   if(item){item.flags.reached=result.reached;if(result.reached)item.flags.attempted=true;else item.flags.attempted=item.records.some(r=>contactFlags(r).attempted);}
   window.dispatchEvent(new CustomEvent('contact-confirmed',{detail:result}));
 }
 return result;
}
export function loadWorkspace() {
 if(!pending)pending=Promise.all(['site_data.json','mapping_sources.json'].map(name=>fetch(new URL('./data/'+name,import.meta.url),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('数据读取失败 HTTP '+r.status);return r.json();}))).then(([site,mapping])=>{
   const contacts=contactsModel(site.contact_progress?.rows||[]);
   return fetch('/api/contact-confirmations',{cache:'no-store'}).then(async response=>{
     if(!response.ok)throw Error('联系确认记录读取失败');
     const updates=(await response.json()).confirmations||{};
     for(const c of contacts)if(updates[c.key]){c.flags.reached=updates[c.key].reached;if(c.flags.reached)c.flags.attempted=true;}
     current={site,mapping,contacts,graph:topicModel(mapping,contacts)};return current;
   });
 }).catch(e=>{pending=undefined;throw e});
 return pending;
}
