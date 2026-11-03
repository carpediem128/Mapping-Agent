import {loadWorkspace} from './workspace_model.mjs';
const $=id=>document.getElementById(id);
function tile(parent,name,value,max,unit,action,palette){
 const b=document.createElement('button');b.type='button';b.className='attention-tile';
 b.style.setProperty('--intensity',String(.12+.72*value/Math.max(1,max)));
 b.dataset.palette=palette;
 const label=document.createElement('strong');label.textContent=name;
 const count=document.createElement('span');count.textContent=value+' '+unit;
 b.append(label,count);b.onclick=action;parent.append(b);
}
function openMapping(name){document.querySelector('.side-nav a[href="#primary-mappings"]')?.click();setTimeout(()=>document.querySelector(`#primary-mappings [data-title="${CSS.escape(name)}"]`)?.click(),180);}
try{
 const {site,graph}=await loadWorkspace();
 const primary=$('primary-attention'),market=$('market-attention');
 const max=Math.max(1,...graph.topics.map(t=>t.companies.length));
 graph.topics.forEach(t=>tile(primary,t.name,t.companies.length,max,'家公司',()=>openMapping(t.name),'research'));
 if(!graph.topics.length)primary.textContent='暂无已导入的一级研究';
 const topics=site.hotspots?.top20||[];
 for(const t of topics){
   const score=Number(t.score);
   if(!Number.isFinite(score))continue;
   tile(market,t.name,score,100,'热度',()=>{document.querySelector('.side-nav a[href="#hotspots"]')?.click();},'market');
 }
 if(!market.childElementCount)market.textContent='暂无可用概念数据';
 const h=site.hotspots||{};
 const date=h.date||h.date_verification?.date;
 $('attention-date').textContent=`一级按主题内公司数着色 · 二级按来源热度（0–100）着色 · ${date?'行情日期 '+date:'行情日期未核验，采集于 '+(h.collected_at||'未记录')}，不代表实时行情`;
}catch(e){$('attention-date').textContent='方向数据暂时不可用：'+e.message;}
