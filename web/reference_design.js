(() => {
 'use strict';
 const icons=['flame','layers','layout-grid','database','network'];
 const routes=['hotspots','primary-mappings','primary-mappings','contacts','contacts'];
 const icon=(name)=>{const i=document.createElement('i');i.dataset.lucide=name;return i;};
 const render=()=>window.lucide?.createIcons({attrs:{'stroke-width':1.6,'aria-hidden':'true'}});
 document.querySelectorAll('.metrics article').forEach((article,index)=>{
   const link=document.createElement('a');link.className='reference-metric-icon';link.href='#'+routes[index];
   const label=article.querySelector('span').textContent;link.setAttribute('aria-label','查看'+label);link.title='查看'+label;
   link.append(icon(icons[index]));article.prepend(link);
   link.onclick=e=>{e.preventDefault();document.querySelector(`.side-nav a[href="#${routes[index]}"]`)?.click();};
 });
 const summary=document.createElement('aside');summary.className='reference-contact-summary';
 const label=document.createElement('span');label.textContent='整体联系覆盖率';
 const value=document.createElement('strong');const track=document.createElement('progress');track.max=100;track.setAttribute('aria-label','整体联系覆盖率');
 summary.append(label,value,track);document.querySelector('.terminal-coverage')?.append(summary);
 const themes=document.createElement('div');themes.className='reference-theme-list';
 document.getElementById('overview-coverage')?.after(themes);
 fetch('./data/mapping_sources.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('来源读取失败');return r.json();}).then(data=>{
   const totals=new Map();
   (data.records||[]).filter(r=>r.sheet==='一级市场').forEach(r=>{
     const name=String(r.source_label||'').replace(/^\d{6}\s*/,'').replace(/\s*Mapping\s*$/i,'').trim();
     totals.set(name,(totals.get(name)||0)+1);
   });
   [...totals].sort((a,b)=>b[1]-a[1]).forEach(([name,count])=>{
     const button=document.createElement('button');button.type='button';
     const title=document.createElement('strong');title.textContent=name;
     const n=document.createElement('span');n.textContent=count;button.append(title,n);
     button.title=`${name} · ${count} 个一级项目`;
     button.onclick=()=>{document.querySelector('.side-nav a[href="#primary-mappings"]')?.click();setTimeout(()=>document.querySelector(`#primary-mappings [data-title="${CSS.escape(name)}"]`)?.click(),150);};
     themes.append(button);
   });
   if(!totals.size)themes.textContent='暂无已导入赛道';
 }).catch(()=>{themes.textContent='赛道数据暂时不可用';});
 const coverage=document.getElementById('metric-contact-rate');
 function update(){value.textContent=coverage.textContent;const n=parseFloat(coverage.textContent);track.value=Number.isFinite(n)?Math.min(100,Math.max(0,n)):0;}
 new MutationObserver(update).observe(coverage,{childList:true,subtree:true,characterData:true});update();
 const prepare=()=>{
   const form=document.getElementById('research-form');
   if(!form||form.dataset.referenceReady)return;
   form.dataset.referenceReady='true';
   const search=icon('search');search.classList.add('reference-search-icon');form.prepend(search);
   const input=form.querySelector('input');input.placeholder='输入主题，或拖入二级热度 / 细分方向 / 公司 / 技术关键词…';
   const submit=form.querySelector('button');submit.append(icon('arrow-right'));
   const toggle=document.getElementById('research-toggle');toggle.prepend(icon('clock-3'));
   render();
 };
 prepare();new MutationObserver(prepare).observe(document.querySelector('.main-column'),{childList:true});render();
})();
