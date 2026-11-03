import {loadWorkspace,funnelStats,clean} from './workspace_model.mjs';

const $=id=>document.getElementById(id);
const ns='http://www.w3.org/2000/svg';
const node=(tag,attrs={},text)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;};
const COLORS={ink:'#33452d',muted:'#67705d',rule:'#dcded0',thread:'#a8b69c',data:'#617952'};
let companies=[],selected='';
// L13 Hourglass Stream: stage barcode widths are proportional to record counts.
function draw(stats){
 const svg=$('contact-funnel');svg.replaceChildren();
 svg.append(node('title',{},`${selected||'全部行业'}：${stats.stages.map(([n,c])=>n+' '+c+' 家').join('，')}`));
 const max=Math.max(1,stats.total),unit=Math.max(1,Math.ceil(max/700)),cx=300;
 const y=k=>48+k*86,width=c=>c/max*460;
 stats.stages.forEach(([name,count],k)=>{
   const cy=y(k),half=width(count)/2;
   svg.append(node('line',{x1:65,y1:cy,x2:535,y2:cy,stroke:COLORS.rule,'stroke-width':1}));
   const ticks=Math.ceil(count/unit);
   for(let t=0;t<ticks;t++){
     const x=cx-half+(t+.5)/ticks*half*2;
     const tick=node('line',{x1:x,y1:cy-11,x2:x,y2:cy+11,stroke:COLORS.data,'stroke-width':Math.max(.8,Math.min(3,460/max*.45)),class:'funnel-tick',style:`--delay:${k*90+Math.min(t,60)*3}ms`});
     tick.append(node('title',{},`${name}：${count} 家`));svg.append(tick);
   }
   if(k<stats.stages.length-1&&count&&stats.stages[k+1][1]){
     const nextHalf=width(stats.stages[k+1][1])/2;
     for(let t=0;t<28;t++){
       const ratio=(t+.5)/28*2-1,xt=cx+ratio*half*.94,xb=cx+ratio*nextHalf*.94;
       svg.append(node('path',{d:`M${xt} ${cy+13} C${xt} ${cy+40} ${xb} ${y(k+1)-40} ${xb} ${y(k+1)-13}`,fill:'none',stroke:COLORS.thread,'stroke-width':.8,'aria-hidden':'true',class:'funnel-thread',style:`--delay:${k*90}ms`}));
     }
   }
   svg.append(node('text',{x:574,y:cy-5,fill:COLORS.muted,'font-size':16},name));
   svg.append(node('text',{x:574,y:cy+22,fill:COLORS.ink,'font-size':23,'font-weight':600},count+' 家'));
   if(k>0)svg.append(node('text',{x:28,y:cy+5,fill:COLORS.muted,'font-size':14,'text-anchor':'middle'},stats.total?Math.round(count/stats.total*100)+'%':'—'));
 });
 $('contact-funnel-note').textContent=`来源：联系总表 · 每条刻度${unit}家公司 · 当前状态快照，不表示同一批次转化率。约见状态未记录 ${stats.meetingUnknown} 家。`;
}
function render(){
 const stats=funnelStats(companies,selected);
 $('contact-funnel-title').textContent=selected||'全部行业';
 $('contact-funnel-meta').textContent=`${stats.total} 家公司 · 有联系方式 ${stats.withContact} 家`;
 document.querySelectorAll('#contact-industry-tags button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.industry===selected)));
 const summary=$('contact-funnel-stages');summary.replaceChildren();
 for(const [label,count] of stats.stages){const item=document.createElement('div');const small=document.createElement('span');small.textContent=label;const strong=document.createElement('strong');strong.textContent=count+' 家';item.append(small,strong);summary.append(item);}
 draw(stats);
}
function choose(industry){
 selected=industry;
 const select=$('contact-industry-filter');
 if(select&&[...select.options].some(o=>o.value===industry)){select.value=industry;select.dispatchEvent(new Event('change',{bubbles:true}));}
 render();
}
async function init(){
 try{
   const workspace=await loadWorkspace();companies=workspace.contacts;
   const industries=[...new Set(companies.flatMap(c=>[...c.industries]))].sort((a,b)=>funnelStats(companies,b).total-funnelStats(companies,a).total||a.localeCompare(b));
   const tags=$('contact-industry-tags');tags.replaceChildren();
   for(const industry of ['',...industries]){
     const button=document.createElement('button');button.type='button';button.dataset.industry=industry;
     const name=document.createElement('span');name.textContent=industry||'全部行业';const count=document.createElement('small');count.textContent=funnelStats(companies,industry).total+' 家';button.append(name,count);button.onclick=()=>choose(industry);tags.append(button);
   }
   $('contact-industry-filter').addEventListener('change',e=>{selected=clean(e.target.value);render();});
   const replay=document.createElement('button');replay.type='button';replay.textContent='重播';replay.className='funnel-replay';replay.setAttribute('aria-label','重播联系漏斗');replay.onclick=()=>render();document.querySelector('.contact-overview-head').append(replay);
   render();
   // Replay only when this page becomes visible; respect reduced-motion CSS.
   new MutationObserver(()=>{if($('contacts').classList.contains('active'))render();}).observe($('contacts'),{attributes:true,attributeFilter:['class']});
 }catch(e){$('contact-funnel-meta').textContent='联系进展暂时不可用';$('contact-funnel-note').textContent=e.message;}
}
init();
